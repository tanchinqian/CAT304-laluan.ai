import { FormEvent, useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User,
} from "@firebase/auth";
import { firebaseAuth } from "./firebase";

type Match = { name: string; score: number; method: "phrase" | "embedding" };
type Analysis = {
  matches: Match[];
  missing: string[];
  readinessScore: number;
  embeddingAvailable: boolean;
  saved?: boolean;
};

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function App() {
  const [outcomes, setOutcomes] = useState(
    "Designed and queried relational databases using SQL.\nBuilt REST API endpoints and tested them with automated tools.\nApplied Python to clean and analyse datasets.",
  );
  const [skills, setSkills] = useState("SQL\nDatabase design\nREST APIs\nPython\nData analysis\nMachine learning");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [plan, setPlan] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [register, setRegister] = useState(false);

  useEffect(() => {
    if (!firebaseAuth) return;
    return onAuthStateChanged(firebaseAuth, setUser);
  }, []);

  async function authAction(event: FormEvent) {
    event.preventDefault();
    if (!firebaseAuth) return;
    setMessage("");
    try {
      if (register) await createUserWithEmailAndPassword(firebaseAuth, email, password);
      else await signInWithEmailAndPassword(firebaseAuth, email, password);
    } catch {
      setMessage("Authentication failed. Check the account details and Firebase Auth setup.");
    }
  }

  async function request(path: string, body: object) {
    const token = await user?.getIdToken();
    const response = await fetch(`${apiUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "The request failed.");
    return data;
  }

  async function analyze(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setPlan("");
    try {
      const data = await request("/api/analyze", {
        outcomes: outcomes.split("\n").filter((line) => line.trim()),
        skills: skills.split("\n").filter((line) => line.trim()),
      });
      setAnalysis(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Analysis failed.");
    } finally {
      setBusy(false);
    }
  }

  async function generatePlan() {
    if (!analysis) return;
    setBusy(true);
    setMessage("");
    try {
      const data = await request("/api/plan", {
        matchedSkills: analysis.matches.map((match) => match.name),
        missingSkills: analysis.missing,
      });
      setPlan(data.plan);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Plan generation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Laluan.ai home"><span className="brand-mark">L</span><span>Laluan<span className="brand-dot">.ai</span></span></a>
        <div className="top-actions">
          <span className="prototype-label">Development prototype</span>
          {user ? (
            <button className="button button-quiet" onClick={() => firebaseAuth && signOut(firebaseAuth)}>{user.email} · Sign out</button>
          ) : firebaseAuth ? (
            <form className="auth-form" onSubmit={authAction}>
              <input aria-label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" required />
              <input aria-label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" minLength={6} required />
              <button className="button button-small" type="submit">{register ? "Create account" : "Sign in"}</button>
              <button className="text-button" type="button" onClick={() => setRegister(!register)}>{register ? "Sign in" : "Register"}</button>
            </form>
          ) : <span className="local-mode">Local development mode</span>}
        </div>
      </header>

      <section className="intro" id="top">
        <div>
          <p className="eyebrow">LEARNING WITH DIRECTION</p>
          <h1>Connect your coursework to your career.</h1>
          <p className="lede">Compare course learning outcomes with the skills required for your chosen pathway.</p>
        </div>
        <div className="score-teaser"><span>USM</span><small>Career readiness workspace</small></div>
      </section>

      <form className="workspace" onSubmit={analyze}>
        <section className="panel input-panel">
          <div className="section-heading"><div><p className="eyebrow">01 · YOUR LEARNING</p><h2>Course outcomes</h2></div><span className="step">Input</span></div>
          <label htmlFor="outcomes">Paste one learning outcome per line</label>
          <textarea id="outcomes" value={outcomes} onChange={(event) => setOutcomes(event.target.value)} rows={8} required />
        </section>
        <section className="panel input-panel">
          <div className="section-heading"><div><p className="eyebrow">02 · YOUR DESTINATION</p><h2>Career skills</h2></div><span className="step">Compare</span></div>
          <label htmlFor="skills">Enter one required skill per line</label>
          <textarea id="skills" value={skills} onChange={(event) => setSkills(event.target.value)} rows={8} required />
          <button className="button button-primary analyze-button" disabled={busy} type="submit">{busy ? "Working…" : "Analyse skill coverage"}<span aria-hidden="true">→</span></button>
        </section>
      </form>

      {message && <p className="notice" role="alert">{message}</p>}
      {analysis && (
        <section className="results panel" aria-live="polite">
          <div className="section-heading"><div><p className="eyebrow">03 · YOUR RESULTS</p><h2>Skill-gap analysis</h2></div><div className="readiness"><strong>{analysis.readinessScore}%</strong><span>readiness</span></div></div>
          <p className="method-note">{analysis.embeddingAvailable ? "Phrase matching + Sentence Transformer similarity" : "Phrase matching · semantic model unavailable"}{analysis.saved ? " · saved to PostgreSQL" : ""}</p>
          <div className="result-columns">
            <div><h3>Covered skills <span>{analysis.matches.length}</span></h3>{analysis.matches.length ? <ul>{analysis.matches.map((match) => <li key={match.name}><span>{match.name}</span><small>{match.method} · {Math.round(match.score * 100)}%</small></li>)}</ul> : <p className="empty">No skills matched yet.</p>}</div>
            <div><h3>To develop <span>{analysis.missing.length}</span></h3>{analysis.missing.length ? <ul>{analysis.missing.map((skill) => <li key={skill}>{skill}</li>)}</ul> : <p className="empty">All listed skills are covered.</p>}</div>
          </div>
          <button className="button button-secondary" disabled={busy || !analysis.missing.length} onClick={generatePlan} type="button">Generate a learning plan with Gemini <span aria-hidden="true">↗</span></button>
          {plan && <div className="plan-output"><h3>Suggested learning plan</h3><p>{plan}</p></div>}
        </section>
      )}
      <footer>Universiti Sains Malaysia · Laluan.ai <span>Connect learning with opportunity.</span></footer>
    </main>
  );
}
