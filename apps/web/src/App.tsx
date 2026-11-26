import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User,
} from "@firebase/auth";
import { firebaseAuth } from "./firebase";

type Session = {
  course: string;
  group: string;
  day: string;
  start: string;
  end: string;
  semester?: string;
};
type Offering = {
  semester: string;
  group: string;
  sessions: { day: string; start: string; end: string }[];
};
type Item = {
  id: string;
  name: string;
  description: string;
  skills: string[];
  prerequisites: string[];
  outcomes?: string[];
  source: string;
  provider?: string;
  url?: string;
  offerings?: Offering[];
  kind?: string;
  addressed?: string[];
  unmet?: string[];
  rank?: number;
  conflicts?: Conflict[];
};
type Conflict = { group: string; status: string; overlaps: string[] };
type Catalogue = {
  notice: string;
  skills: { id: string; name: string }[];
  careers: { id: string; name: string; skills: string[] }[];
  courses: Item[];
  resources: Item[];
};
type Profile = {
  programme: string;
  year: string;
  careerId: string;
  courses: string[];
};
type Analysis = {
  careerId: string;
  covered: string[];
  missing: string[];
  required: number;
  score: number;
  sources: Record<
    string,
    {
      id: string;
      name: string;
      kind: string;
      evidence: string[];
      source: string;
    }[]
  >;
  date: string;
};
type Workspace = {
  revision: number;
  profile: Profile;
  activities: Record<string, string>;
  timetable: Session[];
  semester: string;
  analysis: Analysis | null;
  analysisStatus: string;
  candidates: {
    matches: {
      name: string;
      method: string;
      score: number;
      evidence?: string;
    }[];
    embeddingAvailable: boolean;
    note: string;
  } | null;
  recommendations: Item[];
  activityChecks: Record<string, Conflict[]>;
  plan: {
    id: string;
    order: number;
    explanation: string;
    item: Item;
    conflicts: Conflict[];
  }[];
  planStatus: string;
  planCareerId?: string;
  snapshots: {
    date: string;
    careerId: string;
    score: number;
    covered: number;
    reason: string;
  }[];
};
type Config = {
  authRequired: boolean;
  storage: string;
  geminiConfigured: boolean;
};
const api = import.meta.env.VITE_API_URL || "http://localhost:4000";
const tabs = [
  "Overview & progress",
  "Academic Profile",
  "Skill-Gap Analysis",
  "Recommendations",
  "Learning Plan",
  "My Semester Timetable",
];
const weekdays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const blankSession = (): Session => ({
  course: "",
  group: "A",
  day: "Monday",
  start: "09:00",
  end: "10:00",
});
function sessionId() {
  let id = localStorage.getItem("laluan-session");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("laluan-session", id);
  }
  return id;
}
export default function App() {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [config, setConfig] = useState<Config | null>(null),
    [catalog, setCatalog] = useState<Catalogue | null>(null),
    [state, setState] = useState<Workspace | null>(null);
  const [profile, setProfile] = useState<Profile>({
      programme: "",
      year: "1",
      careerId: "",
      courses: [],
    }),
    [tab, setTab] = useState(tabs[0]),
    [search, setSearch] = useState("");
  const [user, setUser] = useState<User | null>(null),
    [authReady, setAuthReady] = useState(!firebaseAuth),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [failed, setFailed] = useState(false),
    [selected, setSelected] = useState<string[]>([]);
  const [semester, setSemester] = useState("2026/27-1"),
    [sessions, setSessions] = useState<Session[]>([]),
    [entry, setEntry] = useState<Session>(blankSession());
  useEffect(() => {
    if (firebaseAuth)
      return onAuthStateChanged(firebaseAuth, (u) => {
        setUser(u);
        setAuthReady(true);
      });
  }, []);
  const request = useCallback(
    async (path: string, method = "GET", body?: object) => {
      const token = await user?.getIdToken();
      const response = await fetch(`${api}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-dev-session": sessionId(),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(120000),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Request failed. Please retry.");
      return data;
    },
    [user],
  );
  function accept(s: Workspace) {
    setState(s);
    setProfile(s.profile);
    setSelected(Object.keys(s.activities));
    setSessions(s.timetable);
    setSemester(s.semester);
  }
  const load = useCallback(async () => {
    setBusy(true);
    setMessage("");
    try {
      const cfg = await request("/api/config");
      setConfig(cfg);
      if (cfg.authRequired && !user) {
        setState(null);
        return;
      }
      const [cat, s] = await Promise.all([
        request("/api/catalogue"),
        request("/api/workspace"),
      ]);
      setCatalog(cat);
      accept(s);
      setFailed(false);
    } catch (e) {
      setFailed(true);
      setMessage(
        e instanceof Error ? e.message : "Unable to connect. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }, [request, user]);
  useEffect(() => {
    if (authReady) void load();
  }, [load, authReady]);
  async function action(path: string, method: string, body: object = {}) {
    if (!state) return;
    setBusy(true);
    setMessage("");
    try {
      accept(
        await request(path, method, { ...body, revision: state.revision }),
      );
      setFailed(false);
      setMessage("Changes saved.");
    } catch (e) {
      setFailed(true);
      setMessage(e instanceof Error ? e.message : "Could not save. Retry.");
    } finally {
      setBusy(false);
    }
  }
  async function authenticate(e: FormEvent) {
    e.preventDefault();
    if (!firebaseAuth) return;
    setBusy(true);
    setMessage("");
    try {
      if (register)
        await createUserWithEmailAndPassword(firebaseAuth, email, password);
      else await signInWithEmailAndPassword(firebaseAuth, email, password);
      setPassword("");
    } catch (e) {
      setFailed(true);
      const code = (e as { code?: string }).code;
      setMessage(
        code === "auth/email-already-in-use"
          ? "This email is already registered. Sign in instead."
          : code === "auth/weak-password"
            ? "Use a password with at least six characters."
            : "Unable to sign in. Check your email and password, then try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  const skill = (id: string) =>
    catalog?.skills.find((s) => s.id === id)?.name || id;
  const item = (id: string) =>
    [...(catalog?.courses || []), ...(catalog?.resources || [])].find(
      (x) => x.id === id,
    );
  const role = catalog?.careers.find((x) => x.id === state?.profile.careerId);
  const a = state?.analysis;
  const history =
    state?.snapshots.filter((x) => x.careerId === state.profile.careerId) || [];
  function warnings(xs: Conflict[] = []) {
    return xs.map((x, i) => (
      <div
        className={x.overlaps.length ? "warning" : "schedule"}
        key={`${x.group}-${i}`}
      >
        <strong>
          {state?.semester} · Group {x.group}: {x.status}
        </strong>
        {x.overlaps.map((o, j) => (
          <p key={j}>{o}</p>
        ))}
      </div>
    ));
  }
  function details(x: Item) {
    return (
      <details>
        <summary>View details — {x.name}</summary>
        <p>{x.description}</p>
        <p>Skills: {x.skills.map(skill).join(", ") || "Not listed"}</p>
        <p>
          Prerequisites:{" "}
          {x.prerequisites.map((id) => item(id)?.name || id).join(", ") ||
            "None listed"}
        </p>
        {x.unmet?.length ? (
          <p className="warning">Not yet completed: {x.unmet.join(", ")}</p>
        ) : null}
        {x.outcomes?.map((o, i) => (
          <blockquote key={i}>{o}</blockquote>
        ))}
        <p className="muted">Source: {x.source}</p>
        {x.url && (
          <a className="provider" href={x.url} target="_blank" rel="noreferrer">
            Open {x.provider} resource
          </a>
        )}
      </details>
    );
  }
  return (
    <div className="app-shell">
      <aside className={`sidebar${navigationOpen ? " is-open" : ""}`}>
        <div className="sidebar-heading">
          <a
            className="brand"
            href="#main"
            onClick={() => {
              setTab(tabs[0]);
              setNavigationOpen(false);
            }}
            aria-label="laluan.ai home"
          >
            <span>
              laluan<span className="brand-dot">.ai</span>
            </span>
          </a>
          {state && catalog && (
            <button
              className="navigation-toggle"
              aria-expanded={navigationOpen}
              aria-controls="workspace-navigation"
              onClick={() => setNavigationOpen(!navigationOpen)}
            >
              {navigationOpen ? "Close menu" : "Menu"}
            </button>
          )}
        </div>
        {state && catalog && (
          <nav id="workspace-navigation" aria-label="Workspace sections">
            {tabs.map((t) => (
              <button
                key={t}
                aria-current={tab === t ? "page" : undefined}
                className={tab === t ? "active" : ""}
                onClick={() => {
                  setTab(t);
                  setNavigationOpen(false);
                }}
              >
                {t}
              </button>
            ))}
          </nav>
        )}
      </aside>
      <main className="page" id="main">
        {user && (
          <header className="topbar">
            <div className="top-actions">
              {user && (
                <button
                  className="button button-quiet"
                  disabled={busy}
                  onClick={() => firebaseAuth && signOut(firebaseAuth)}
                >
                  {user.email} · Sign out
                </button>
              )}
            </div>
          </header>
        )}
        {message && (
          <div
            className={failed ? "notice error" : "notice"}
            role={failed ? "alert" : "status"}
          >
            {message}
            {failed && (
              <button
                className="button button-quiet"
                disabled={busy}
                onClick={() => void load()}
              >
                Reload saved workspace
              </button>
            )}
          </div>
        )}
        {busy && (
          <p role="status" aria-live="polite">
            Saving and updating your results…
          </p>
        )}
        {!state && (
          <section className="panel auth-panel">
            <h2>
              {config?.authRequired
                ? "Sign in to your workspace"
                : "Connect to laluan.ai"}
            </h2>
            {config?.authRequired && firebaseAuth ? (
              <form onSubmit={authenticate}>
                <label>
                  Email
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <label>
                  Password
                  <input
                    type="password"
                    minLength={6}
                    required
                    autoComplete={
                      register ? "new-password" : "current-password"
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
                <button className="button button-primary" disabled={busy}>
                  {register ? "Create account" : "Sign in"}
                </button>
                <button
                  className="button button-quiet"
                  type="button"
                  onClick={() => setRegister(!register)}
                >
                  {register
                    ? "Already registered? Sign in"
                    : "Create a student account"}
                </button>
              </form>
            ) : (
              <p>
                {config?.authRequired
                  ? "Sign-in is unavailable. Please contact the project team."
                  : "Unable to connect to the server. Please try again shortly."}
              </p>
            )}
            <button
              className="button button-quiet"
              disabled={busy}
              onClick={() => void load()}
            >
              Retry connection
            </button>
          </section>
        )}
        {state && catalog && (
          <>
            <div className="content" aria-busy={busy}>
              {tab === tabs[0] && (
                <section>
                  <h2>Career readiness</h2>
                  <p>
                    {role?.name ||
                      "Choose a target career on Academic Profile."}
                  </p>
                  <div className="overview">
                    <div>
                      <strong className="score">
                        {a ? `${a.score}%` : "Unavailable"}
                      </strong>
                      <p>
                        {a
                          ? `${a.covered.length} of ${a.required} career skills covered`
                          : "No score calculated yet"}
                      </p>
                    </div>
                    <div>
                      <p>
                        {state.profile.courses.length} completed{" "}
                        {state.profile.courses.length === 1
                          ? "course"
                          : "courses"}
                      </p>
                      <p>
                        {a?.missing.length ?? "—"}{" "}
                        {a?.missing.length === 1 ? "skill" : "skills"} to
                        develop
                      </p>
                      <button
                        className="button button-secondary"
                        onClick={() => setTab(tabs[2])}
                      >
                        View Skill Breakdown
                      </button>
                    </div>
                  </div>
                  <h2>Progress for {role?.name || "your career"}</h2>
                  {history.length ? (
                    <>
                      <svg
                        className="progress-chart"
                        viewBox="0 0 600 150"
                        role="img"
                        aria-label="Recorded skill coverage over time, for the selected career"
                      >
                        <line
                          x1="20"
                          y1="130"
                          x2="580"
                          y2="130"
                          stroke="currentColor"
                        />
                        <polyline
                          fill="none"
                          stroke="#5f259f"
                          strokeWidth="3"
                          points={history
                            .map(
                              (h, i) =>
                                `${20 + (i * 560) / Math.max(history.length - 1, 1)},${130 - h.score * 1.1}`,
                            )
                            .join(" ")}
                        />
                        {history.map((h, i) => (
                          <circle
                            key={i}
                            cx={
                              20 + (i * 560) / Math.max(history.length - 1, 1)
                            }
                            cy={130 - h.score * 1.1}
                            r="4"
                            fill="#805600"
                          />
                        ))}
                      </svg>
                      {history.length === 1 && (
                        <p>
                          This is your baseline. Future updates add progress
                          points.
                        </p>
                      )}
                      <ol className="milestones">
                        {history.slice(-10).map((h, i) => (
                          <li key={i}>
                            <time>{new Date(h.date).toLocaleString()}</time> —{" "}
                            {h.reason}: {h.score}% ({h.covered} skills)
                          </li>
                        ))}
                      </ol>
                    </>
                  ) : (
                    <p>
                      No milestones yet. Save a career and your completed
                      courses.
                    </p>
                  )}
                  <h2>Current plan</h2>
                  <p>{state.planStatus}</p>
                  <details>
                    <summary>Timetable checks for recommended courses</summary>
                    {state.recommendations
                      .filter((x) => x.kind === "course")
                      .map((x) => (
                        <div key={x.id}>
                          <h3>{x.name}</h3>
                          {warnings(x.conflicts)}
                        </div>
                      ))}
                    {!state.recommendations.some(
                      (x) => x.kind === "course",
                    ) && <p>No recommended course sessions to check.</p>}
                  </details>
                  <button
                    className="button button-secondary"
                    onClick={() => setTab(tabs[4])}
                  >
                    Open Learning Plan
                  </button>
                </section>
              )}
              {tab === tabs[1] && (
                <section>
                  <h2>Academic Profile</h2>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void action("/api/profile", "PUT", { profile });
                    }}
                  >
                    <div className="form-grid">
                      <label>
                        Programme
                        <input
                          maxLength={120}
                          value={profile.programme}
                          onChange={(e) =>
                            setProfile({
                              ...profile,
                              programme: e.target.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        Year of study
                        <select
                          value={profile.year}
                          onChange={(e) =>
                            setProfile({ ...profile, year: e.target.value })
                          }
                        >
                          {["1", "2", "3", "4", "5", "6"].map((y) => (
                            <option key={y}>{y}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Target career
                        <select
                          value={profile.careerId}
                          onChange={(e) =>
                            setProfile({ ...profile, careerId: e.target.value })
                          }
                        >
                          <option value="">Select a career</option>
                          {catalog.careers.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <h3>Completed courses</h3>
                    <label>
                      Search course code or name
                      <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </label>
                    <div className="course-list">
                      {catalog.courses
                        .filter((x) =>
                          (x.name + x.id)
                            .toLowerCase()
                            .includes(search.toLowerCase()),
                        )
                        .map((x) => (
                          <label className="check-row" key={x.id}>
                            <input
                              type="checkbox"
                              checked={profile.courses.includes(x.id)}
                              onChange={(e) =>
                                setProfile({
                                  ...profile,
                                  courses: e.target.checked
                                    ? [...profile.courses, x.id]
                                    : profile.courses.filter(
                                        (id) => id !== x.id,
                                      ),
                                })
                              }
                            />
                            <span>
                              <strong>{x.id}</strong> {x.name}
                            </span>
                          </label>
                        ))}
                    </div>
                    <p>
                      {profile.courses.length} selected. Saving replaces your
                      previous course selections.
                    </p>
                    <button disabled={busy} className="button button-primary">
                      Save & analyse
                    </button>
                  </form>
                </section>
              )}
              {tab === tabs[2] && (
                <section>
                  <h2>Skill-Gap Analysis</h2>
                  <p>
                    Saved target: {role?.name || "Not selected"}. Saved courses:{" "}
                    {state.profile.courses.join(", ") || "None"}.
                  </p>
                  <details>
                    <summary>Review saved course outcomes</summary>
                    {state.profile.courses.map((id) => (
                      <div key={id}>{details(item(id)!)}</div>
                    ))}
                  </details>
                  <button
                    className="button button-primary"
                    disabled={busy || !state.profile.careerId}
                    onClick={() => void action("/api/analyze", "POST")}
                  >
                    Run Analysis
                  </button>
                  {!a ? (
                    <p>
                      Choose a career and save your learning records to
                      calculate coverage.
                    </p>
                  ) : (
                    <>
                      <p>
                        {a.score}% coverage — {a.covered.length}/{a.required}{" "}
                        required skills
                      </p>
                      <div className="result-columns">
                        <div>
                          <h3>Matched Skills</h3>
                          {!a.covered.length && <p>No covered skills yet.</p>}
                          {a.covered.map((s) => (
                            <details key={s}>
                              <summary>{skill(s)} — View Evidence</summary>
                              {a.sources[s].map((source, i) => (
                                <div key={i}>
                                  <strong>{source.name}</strong>
                                  {source.evidence.map((e, j) => (
                                    <blockquote key={j}>{e}</blockquote>
                                  ))}
                                  <p className="muted">{source.source}</p>
                                </div>
                              ))}
                            </details>
                          ))}
                        </div>
                        <div>
                          <h3>Missing Skills</h3>
                          {!a.missing.length && (
                            <p>All listed skills are covered.</p>
                          )}
                          {a.missing.map((s) => (
                            <details key={s}>
                              <summary>{skill(s)}</summary>
                              <p>
                                Your completed learning does not cover this
                                skill yet.
                              </p>
                              <button
                                className="button button-quiet"
                                onClick={() => setTab(tabs[3])}
                              >
                                Find relevant learning
                              </button>
                            </details>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                  <details>
                    <summary>Suggested skill matches</summary>
                    <p>
                      Suggestions require review before they count towards your
                      score.
                    </p>
                    {!state.candidates && (
                      <p>Run analysis to find suggestions.</p>
                    )}
                    {state.candidates?.note.includes("unavailable") && (
                      <p>
                        Some suggestions are unavailable. Try running analysis
                        again later.
                      </p>
                    )}
                    {state.candidates && !state.candidates.matches.length && (
                      <p>No additional suggestions.</p>
                    )}
                    {state.candidates?.matches.map((m, i) => (
                      <div className="candidate" key={i}>
                        <strong>{m.name}</strong> · {Math.round(m.score * 100)}%
                        similarity
                        <blockquote>{m.evidence}</blockquote>
                      </div>
                    ))}
                  </details>
                </section>
              )}
              {tab === tabs[3] && (
                <section>
                  <h2>Recommendations</h2>
                  <p>
                    Ranked by the proportion of your missing skills addressed.
                    Prerequisites are shown before selection.
                  </p>
                  {!a && <p>Run skill-gap analysis first.</p>}
                  {["course", "external"].map((kind) => (
                    <div key={kind}>
                      <h3>
                        {kind === "course"
                          ? "USM courses"
                          : "External learning resources"}
                      </h3>
                      {!state.recommendations.filter((x) => x.kind === kind)
                        .length && (
                        <p>No matching options in the current catalogue.</p>
                      )}
                      {state.recommendations
                        .filter((x) => x.kind === kind)
                        .map((x) => (
                          <article className="learning-row" key={x.id}>
                            <label className="check-row">
                              <input
                                type="checkbox"
                                checked={selected.includes(x.id)}
                                onChange={(e) =>
                                  setSelected(
                                    e.target.checked
                                      ? [...selected, x.id]
                                      : selected.filter((id) => id !== x.id),
                                  )
                                }
                              />
                              <strong>{x.name}</strong>
                            </label>
                            <p>
                              Addresses {x.addressed?.map(skill).join(", ")} ·{" "}
                              {Math.round((x.rank || 0) * 100)}% of missing
                              skills
                            </p>
                            {warnings(x.conflicts)}
                            {details(x)}
                          </article>
                        ))}
                    </div>
                  ))}
                  <button
                    className="button button-primary"
                    disabled={busy || !selected.length}
                    onClick={() =>
                      void action("/api/activities", "PUT", { ids: selected })
                    }
                  >
                    Save selected activities
                  </button>
                </section>
              )}
              {tab === tabs[4] && (
                <section>
                  <h2>Learning Plan</h2>
                  <p role="status">
                    {state.planStatus === "Gemini plan — validated"
                      ? "Plan ready"
                      : state.planStatus === "Local preview (not Gemini)"
                        ? "Preview ready"
                        : state.planStatus.startsWith("Awaiting refresh")
                          ? "Your plan needs updating. Generate a new plan or preview without AI."
                          : state.planStatus}
                  </p>
                  {state.planCareerId &&
                    state.planCareerId !== state.profile.careerId && (
                      <p className="warning">
                        This retained plan belongs to a previous target career.
                        Refresh before using it.
                      </p>
                    )}
                  <div className="actions">
                    <button
                      className="button button-primary"
                      disabled={busy || !a}
                      onClick={() =>
                        void action("/api/plan", "POST", { mode: "gemini" })
                      }
                    >
                      Generate learning plan
                    </button>
                    <button
                      className="button button-secondary"
                      disabled={busy || !a}
                      onClick={() =>
                        void action("/api/plan", "POST", { mode: "local" })
                      }
                    >
                      Preview without AI
                    </button>
                  </div>
                  {state.plan.map((p) => (
                    <article className="learning-row" key={p.id}>
                      <h3>
                        {p.order}. {p.item.name}
                      </h3>
                      <p>{p.explanation}</p>
                      {warnings(p.conflicts)}
                      {details(p.item)}
                      {!state.activities[p.id] && (
                        <button
                          disabled={busy}
                          className="button button-quiet"
                          onClick={() =>
                            void action("/api/activities", "PUT", {
                              ids: [...Object.keys(state.activities), p.id],
                            })
                          }
                        >
                          Add to tracker
                        </button>
                      )}
                    </article>
                  ))}
                  <h2>Learning Activity Tracker</h2>
                  <p>
                    Mark completed activities here. Only skills linked to an
                    activity count towards your score.
                  </p>
                  {!Object.keys(state.activities).length && (
                    <p>
                      Select recommendations or add plan activities to begin
                      tracking.
                    </p>
                  )}
                  {Object.entries(state.activities).map(([id, status]) => (
                    <article className="learning-row" key={id}>
                      <div className="tracker-row">
                        <strong>{item(id)?.name || id}</strong>
                        <label>
                          Status for {id}
                          <select
                            disabled={busy}
                            value={status}
                            onChange={(e) =>
                              void action("/api/activity", "PATCH", {
                                id,
                                status: e.target.value,
                              })
                            }
                          >
                            {["Pending", "In Progress", "Completed"].map(
                              (x) => (
                                <option key={x}>{x}</option>
                              ),
                            )}
                          </select>
                        </label>
                        <button
                          className="button button-quiet"
                          disabled={busy}
                          onClick={() =>
                            void action("/api/activities", "PUT", {
                              ids: Object.keys(state.activities).filter(
                                (x) => x !== id,
                              ),
                            })
                          }
                        >
                          Remove {id}
                        </button>
                      </div>
                      {warnings(state.activityChecks?.[id])}
                    </article>
                  ))}
                </section>
              )}
              {tab === tabs[5] && (
                <section>
                  <h2>My Semester Timetable</h2>
                  <p>
                    Enter existing lectures, tutorials and labs. Each row is one
                    weekly session. Recommendations are checked against the
                    saved semester and class group data; adjacent sessions do
                    not clash.
                  </p>
                  <label>
                    Semester
                    <input
                      value={semester}
                      maxLength={30}
                      onChange={(e) => setSemester(e.target.value)}
                    />
                  </label>
                  <form
                    className="session-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (entry.end <= entry.start) {
                        setFailed(true);
                        setMessage("End time must be later than start time.");
                        return;
                      }
                      setSessions([...sessions, { ...entry, semester }]);
                      setEntry(blankSession());
                    }}
                  >
                    <label>
                      Course
                      <input
                        required
                        maxLength={100}
                        value={entry.course}
                        onChange={(e) =>
                          setEntry({ ...entry, course: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Class group
                      <input
                        maxLength={30}
                        value={entry.group}
                        onChange={(e) =>
                          setEntry({ ...entry, group: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Day
                      <select
                        value={entry.day}
                        onChange={(e) =>
                          setEntry({ ...entry, day: e.target.value })
                        }
                      >
                        {weekdays.map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Start
                      <input
                        type="time"
                        required
                        value={entry.start}
                        onChange={(e) =>
                          setEntry({ ...entry, start: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      End
                      <input
                        type="time"
                        required
                        value={entry.end}
                        onChange={(e) =>
                          setEntry({ ...entry, end: e.target.value })
                        }
                      />
                    </label>
                    <button className="button button-secondary">
                      Add session
                    </button>
                  </form>
                  <ul className="session-list">
                    {sessions.map((s, i) => (
                      <li key={i}>
                        {s.course} ({s.group}) — {s.day} {s.start}–{s.end}
                        <button
                          className="button button-quiet"
                          onClick={() => {
                            setEntry(s);
                            setSessions(sessions.filter((_, j) => j !== i));
                          }}
                        >
                          Edit session {i + 1}
                        </button>
                        <button
                          className="button button-quiet"
                          onClick={() =>
                            setSessions(sessions.filter((_, j) => j !== i))
                          }
                        >
                          Remove session {i + 1}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button
                    className="button button-primary"
                    disabled={busy}
                    onClick={() =>
                      void action("/api/timetable", "PUT", {
                        semester,
                        timetable: sessions,
                      })
                    }
                  >
                    Save timetable & check conflicts
                  </button>
                  <h3>Current recommendation checks</h3>
                  {state.recommendations
                    .filter((x) => x.kind === "course")
                    .map((x) => (
                      <article className="learning-row" key={x.id}>
                        <h3>{x.name}</h3>
                        {warnings(x.conflicts)}
                      </article>
                    ))}
                </section>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
