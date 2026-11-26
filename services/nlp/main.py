import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

import spacy
from dotenv import load_dotenv
from fastapi import FastAPI
from pydantic import BaseModel, Field
from spacy.matcher import PhraseMatcher
from sentence_transformers import SentenceTransformer, util

load_dotenv(Path(__file__).resolve().parents[2] / ".env")
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("laluan.nlp")
nlp = spacy.blank("en")
nlp.add_pipe("sentencizer")
model: SentenceTransformer | None = None
model_name = os.getenv("SENTENCE_TRANSFORMER_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
embeddings_enabled = os.getenv("ENABLE_EMBEDDINGS", "true").lower() == "true"
similarity_threshold = float(os.getenv("SIMILARITY_THRESHOLD", "0.55"))


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global model
    if embeddings_enabled:
        try:
            model = SentenceTransformer(model_name)
        except Exception:
            logger.warning("Sentence Transformer unavailable; using phrase matching only.")
    yield


app = FastAPI(title="Laluan NLP Service", version="0.1.0", lifespan=lifespan)


class MatchRequest(BaseModel):
    outcomes: list[str] = Field(min_length=1, max_length=50)
    skills: list[str] = Field(min_length=1, max_length=100)
    aliases: dict[str, list[str]] = Field(default_factory=dict)


@app.get("/health")
def health():
    return {"status": "ok", "phraseMatcher": "spacy", "embeddingAvailable": model is not None}


@app.post("/match")
def match(request: MatchRequest):
    matcher = PhraseMatcher(nlp.vocab, attr="LOWER")
    valid_skills = [skill.strip() for skill in request.skills if skill.strip()]
    if not valid_skills:
        return {"matches": [], "missing": [], "readinessScore": 0, "embeddingAvailable": model is not None}

    labels = {}
    for skill in valid_skills:
        for term in [skill, *request.aliases.get(skill, [])]:
            if term.strip():
                labels[term.lower()] = skill
    matcher.add("SKILL", [nlp.make_doc(term) for term in labels])
    found: dict[str, dict] = {}
    sentences = [s.text for outcome in request.outcomes for s in nlp(outcome).sents]
    for outcome in sentences:
        doc = nlp(outcome)
        for _, start, end in matcher(doc):
            skill = doc[start:end].text.lower()
            label = labels.get(skill.lower())
            if label:
                found[label.lower()] = {"name": label, "score": 1.0, "method": "phrase", "evidence": outcome}

    if model is not None:
        outcome_vectors = model.encode(sentences, convert_to_tensor=True, normalize_embeddings=True)
        skill_vectors = model.encode(valid_skills, convert_to_tensor=True, normalize_embeddings=True)
        similarities = util.cos_sim(outcome_vectors, skill_vectors)
        for index, skill in enumerate(valid_skills):
            if skill.lower() in found:
                continue
            score = float(similarities[:, index].max().item())
            if score >= similarity_threshold:
                sentence_index = int(similarities[:, index].argmax().item())
                found[skill.lower()] = {"name": skill, "score": round(score, 4), "method": "embedding", "evidence": sentences[sentence_index]}

    matches = list(found.values())
    covered = set(found)
    missing = [skill for skill in valid_skills if skill.lower() not in covered]
    return {
        "matches": matches,
        "missing": missing,
        "readinessScore": round(len(matches) / len(valid_skills) * 100),
        "embeddingAvailable": model is not None,
    }
