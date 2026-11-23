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


@app.get("/health")
def health():
    return {"status": "ok", "phraseMatcher": "spacy", "embeddingAvailable": model is not None}


@app.post("/match")
def match(request: MatchRequest):
    matcher = PhraseMatcher(nlp.vocab, attr="LOWER")
    valid_skills = [skill.strip() for skill in request.skills if skill.strip()]
    if not valid_skills:
        return {"matches": [], "missing": [], "readinessScore": 0, "embeddingAvailable": model is not None}

    patterns = [nlp.make_doc(skill) for skill in valid_skills]
    matcher.add("SKILL", patterns)
    found: dict[str, dict] = {}
    for outcome in request.outcomes:
        doc = nlp(outcome)
        for _, start, end in matcher(doc):
            skill = doc[start:end].text.lower()
            label = next((value for value in valid_skills if value.lower() == skill.lower()), None)
            if label:
                found[label.lower()] = {"name": label, "score": 1.0, "method": "phrase"}

    if model is not None:
        outcome_vectors = model.encode(request.outcomes, convert_to_tensor=True, normalize_embeddings=True)
        skill_vectors = model.encode(valid_skills, convert_to_tensor=True, normalize_embeddings=True)
        similarities = util.cos_sim(outcome_vectors, skill_vectors)
        for index, skill in enumerate(valid_skills):
            if skill.lower() in found:
                continue
            score = float(similarities[:, index].max().item())
            if score >= similarity_threshold:
                found[skill.lower()] = {"name": skill, "score": round(score, 4), "method": "embedding"}

    matches = list(found.values())
    covered = set(found)
    missing = [skill for skill in valid_skills if skill.lower() not in covered]
    return {
        "matches": matches,
        "missing": missing,
        "readinessScore": round(len(matches) / len(valid_skills) * 100),
        "embeddingAvailable": model is not None,
    }
