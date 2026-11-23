const path = require("node:path");
require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });

const cors = require("cors");
const express = require("express");
const { Pool } = require("pg");

const app = express();
const port = Number(process.env.API_PORT || 4000);
const nlpUrl = process.env.NLP_API_URL || "http://localhost:8000";
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : null;
const authRequired = process.env.AUTH_REQUIRED === "true";

let firebaseAuth;
if (authRequired) {
  const { applicationDefault, initializeApp } = require("firebase-admin/app");
  const { getAuth } = require("firebase-admin/auth");
  const firebaseApp = initializeApp({
    credential: applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID || undefined,
  });
  firebaseAuth = getAuth(firebaseApp);
}

app.use(cors({ origin: (process.env.WEB_ORIGIN || "http://localhost:5173").split(",") }));
app.use(express.json({ limit: "1mb" }));

async function requireAuth(req, res, next) {
  if (!authRequired) return next();
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return res.status(401).json({ error: "Sign in is required." });
  try {
    req.user = await firebaseAuth.verifyIdToken(token);
    next();
  } catch {
    res.status(401).json({ error: "The sign-in token is invalid or expired." });
  }
}

function textList(value, limit) {
  if (!Array.isArray(value) || value.length === 0 || value.length > limit) return null;
  const items = value.map((item) => typeof item === "string" ? item.trim() : "");
  if (items.some((item) => !item || item.length > 1000)) return null;
  return items;
}

app.get("/api/health", async (_req, res) => {
  let database = "not configured";
  let nlp = "unavailable";
  if (pool) {
    try { await pool.query("SELECT 1"); database = "connected"; }
    catch { database = "unavailable"; }
  }
  try {
    const response = await fetch(`${nlpUrl}/health`, { signal: AbortSignal.timeout(3000) });
    if (response.ok) nlp = "connected";
  } catch { /* The web and API can still start while the NLP service is starting. */ }
  res.status(nlp === "connected" && (!pool || database === "connected") ? 200 : 503).json({
    status: nlp === "connected" && (!pool || database === "connected") ? "ok" : "degraded",
    services: { api: "ok", nlp, database },
  });
});

app.post("/api/analyze", requireAuth, async (req, res) => {
  const outcomes = textList(req.body?.outcomes, 50);
  const skills = textList(req.body?.skills, 100);
  if (!outcomes || !skills) {
    return res.status(400).json({ error: "Provide 1–50 outcomes and 1–100 skills, each no longer than 1,000 characters." });
  }

  try {
    const response = await fetch(`${nlpUrl}/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcomes, skills }),
      signal: AbortSignal.timeout(60000),
    });
    const result = await response.json();
    if (!response.ok) return res.status(502).json({ error: "The NLP service could not analyse these outcomes." });

    let saved = false;
    if (pool) {
      await pool.query(
        "INSERT INTO analysis_history (firebase_uid, course_outcomes, required_skills, result) VALUES ($1, $2, $3, $4)",
        [req.user?.uid || null, outcomes, skills, result],
      );
      saved = true;
    }
    res.json({ ...result, saved });
  } catch {
    res.status(503).json({ error: "Analysis is temporarily unavailable. Check the NLP service and database." });
  }
});

app.post("/api/plan", requireAuth, async (req, res) => {
  const matchedSkills = textList(req.body?.matchedSkills || [], 100) || [];
  const missingSkills = textList(req.body?.missingSkills || [], 100);
  if (!missingSkills) return res.status(400).json({ error: "Provide 1–100 missing skills." });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "Add GEMINI_API_KEY to your local .env file to enable Gemini plan generation." });

  try {
    const model = encodeURIComponent(process.env.GEMINI_MODEL || "gemini-3.5-flash-lite");
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Create a concise, practical four-week learning plan for a university student. Use the covered skills as strengths and address the missing skills. Return plain text with weekly actions. Covered skills: ${matchedSkills.join(", ") || "none"}. Missing skills: ${missingSkills.join(", ")}.` }] }],
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) return res.status(502).json({ error: "Gemini could not generate a plan. Check the model name and API access." });
    const data = await response.json();
    const plan = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n").trim();
    if (!plan) return res.status(502).json({ error: "Gemini returned an empty plan." });
    res.json({ plan });
  } catch {
    res.status(502).json({ error: "Gemini is temporarily unavailable." });
  }
});

app.listen(port, "0.0.0.0", () => console.log(`Laluan API listening on port ${port}`));

process.on("SIGTERM", async () => {
  if (pool) await pool.end();
  process.exit(0);
});
