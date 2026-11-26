const fs = require("node:fs");
const path = require("node:path");
const catalog = JSON.parse(
  fs.readFileSync(
    process.env.CATALOGUE_PATH || path.join(__dirname, "catalogue.json"),
    "utf8",
  ),
);
const items = [
  ...catalog.courses.map((x) => ({ ...x, kind: "course" })),
  ...catalog.resources.map((x) => ({ ...x, kind: "external" })),
];
const itemById = (id) => items.find((x) => x.id === id);
const unique = (xs) => [...new Set(xs)];
const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
function check(ok, message) {
  if (!ok) {
    const e = new Error(message);
    e.status = 400;
    throw e;
  }
}
// Fail at startup rather than compute coverage from invalid catalogue identifiers.
const ids = items.map((x) => x.id);
check(
  unique(ids).length === ids.length,
  "Catalogue activity IDs must be unique.",
);
for (const x of [...items, ...catalog.careers])
  check(
    x.skills.every((s) => catalog.skills.some((k) => k.id === s)),
    "Unknown catalogue skill.",
  );
for (const x of items)
  check(
    x.prerequisites.every((id) => ids.includes(id)),
    "Unknown prerequisite.",
  );
function initial() {
  return {
    revision: 0,
    profile: { programme: "", year: "1", careerId: "", courses: [] },
    activities: {},
    timetable: [],
    semester: "2026/27-1",
    analysis: null,
    candidates: null,
    snapshots: [],
    plan: [],
    planStatus: "Not generated",
    analysisStatus: "Not run",
  };
}
function coverage(state) {
  const role = catalog.careers.find((x) => x.id === state.profile.careerId);
  if (!role?.skills.length) return null;
  const required = unique(role.skills),
    sources = {};
  const completed = unique([
    ...state.profile.courses,
    ...Object.entries(state.activities)
      .filter(([, status]) => status === "Completed")
      .map(([id]) => id),
  ]);
  for (const id of completed) {
    const item = itemById(id);
    if (!item) continue;
    for (const skill of item.skills) {
      if (!required.includes(skill)) continue;
      (sources[skill] ||= []).push({
        id,
        name: item.name,
        kind: item.kind,
        evidence: item.kind === "course" ? item.outcomes : [item.source],
        source: item.source,
      });
    }
  }
  const covered = required.filter((s) => sources[s]);
  return {
    careerId: role.id,
    covered,
    missing: required.filter((s) => !sources[s]),
    required: required.length,
    score: Math.round((covered.length / required.length) * 100),
    sources,
    date: new Date().toISOString(),
  };
}
function conflicts(item, state) {
  if (item.kind !== "course") return [];
  const offerings = (item.offerings || []).filter(
    (o) => o.semester === state.semester,
  );
  if (!offerings.length)
    return [
      { group: "Unknown", status: "Timetable not checked", overlaps: [] },
    ];
  return offerings.map((o) => {
    if (!state.timetable.length || !o.sessions.length)
      return { group: o.group, status: "Timetable not checked", overlaps: [] };
    const overlaps = [];
    for (const s of o.sessions)
      for (const t of state.timetable)
        if (
          t.semester === state.semester &&
          s.day === t.day &&
          s.start < t.end &&
          t.start < s.end
        )
          overlaps.push(
            `${s.day} ${s.start}–${s.end} overlaps ${t.course} (${t.group}) ${t.start}–${t.end}`,
          );
    return {
      group: o.group,
      status: overlaps.length ? "Timetable conflict" : "No conflict detected",
      overlaps,
    };
  });
}
function recommendations(state) {
  const a = state.analysis;
  if (!a || a.careerId !== state.profile.careerId) return [];
  const completed = unique([
    ...state.profile.courses,
    ...Object.keys(state.activities).filter(
      (id) => state.activities[id] === "Completed",
    ),
  ]);
  return items
    .filter((x) => !completed.includes(x.id))
    .map((x) => {
      const addressed = x.skills.filter((s) => a.missing.includes(s));
      return {
        ...x,
        addressed,
        rank: a.missing.length ? addressed.length / a.missing.length : 0,
        unmet: x.prerequisites.filter((id) => !completed.includes(id)),
        conflicts: conflicts(x, state),
      };
    })
    .filter((x) => x.addressed.length)
    .sort((a, b) => b.rank - a.rank || a.id.localeCompare(b.id));
}
function validateProfile(p) {
  check(
    p && typeof p.programme === "string" && p.programme.trim().length <= 120,
    "Programme must be at most 120 characters.",
  );
  check(
    ["1", "2", "3", "4", "5", "6"].includes(p.year),
    "Choose a valid year.",
  );
  check(
    p.careerId === "" || catalog.careers.some((x) => x.id === p.careerId),
    "Choose an available career.",
  );
  check(
    Array.isArray(p.courses) &&
      p.courses.length <= catalog.courses.length &&
      p.courses.every((id) => catalog.courses.some((x) => x.id === id)),
    "Choose courses from the catalogue.",
  );
  return {
    programme: p.programme.trim(),
    year: p.year,
    careerId: p.careerId,
    courses: unique(p.courses),
  };
}
function validateTimetable(rows, semester) {
  check(
    typeof semester === "string" && /^[\w/-]{1,30}$/.test(semester),
    "Enter a semester such as 2026/27-1.",
  );
  check(
    Array.isArray(rows) && rows.length <= 100,
    "Use at most 100 timetable sessions.",
  );
  return rows.map((t) => {
    check(
      t &&
        typeof t.course === "string" &&
        t.course.trim().length > 0 &&
        t.course.length <= 100 &&
        typeof t.group === "string" &&
        t.group.length <= 30 &&
        days.includes(t.day) &&
        /^([01]\d|2[0-3]):[0-5]\d$/.test(t.start) &&
        /^([01]\d|2[0-3]):[0-5]\d$/.test(t.end) &&
        t.start < t.end,
      "Each session needs a course, valid day and end time later than start time.",
    );
    return {
      course: t.course.trim(),
      group: t.group.trim(),
      day: t.day,
      start: t.start,
      end: t.end,
      semester,
    };
  });
}
function validatePlan(plan, state) {
  check(
    Array.isArray(plan) && plan.length > 0 && plan.length <= 30,
    "The plan must contain 1–30 activities.",
  );
  const eligible = recommendations(state),
    seen = new Set(
      state.profile.courses.concat(
        Object.keys(state.activities).filter(
          (id) => state.activities[id] === "Completed",
        ),
      ),
    );
  const ordered = new Set();
  for (const [i, p] of plan.entries()) {
    check(
      p && typeof p.id === "string" && !ordered.has(p.id),
      "Plan has invalid or duplicate identifiers.",
    );
    const item = eligible.find((x) => x.id === p.id);
    check(
      item && item.addressed.length > 0,
      "Plan contains an ineligible activity or unsupported skill mapping.",
    );
    check(
      item.prerequisites.every((id) => seen.has(id)),
      "Plan violates prerequisite order.",
    );
    check(
      p.order === i + 1 &&
        typeof p.explanation === "string" &&
        p.explanation.trim().length > 0 &&
        p.explanation.length <= 1200,
      "Plan order or explanation is invalid.",
    );
    seen.add(p.id);
    ordered.add(p.id);
  }
  const selected = Object.keys(state.activities).filter(
    (id) =>
      state.activities[id] !== "Completed" && eligible.some((x) => x.id === id),
  );
  check(
    selected.every((id) => ordered.has(id)),
    "The plan omitted a selected eligible activity. Review selections or regenerate.",
  );
  return plan.map((p) => ({
    id: p.id,
    order: p.order,
    explanation: p.explanation.trim(),
  }));
}
function localPlan(state) {
  const eligible = recommendations(state);
  const chosen = Object.keys(state.activities).filter(
    (id) =>
      state.activities[id] !== "Completed" && eligible.some((x) => x.id === id),
  );
  const wanted = new Set(chosen);
  function includePrerequisites(id, visiting = new Set()) {
    if (visiting.has(id)) return;
    visiting.add(id);
    for (const prerequisite of eligible.find((x) => x.id === id)
      ?.prerequisites || []) {
      if (eligible.some((x) => x.id === prerequisite)) {
        wanted.add(prerequisite);
        includePrerequisites(prerequisite, visiting);
      }
    }
  }
  chosen.forEach((id) => includePrerequisites(id));
  const left = eligible.filter((x) => !chosen.length || wanted.has(x.id)),
    done = new Set(
      state.profile.courses.concat(
        Object.keys(state.activities).filter(
          (id) => state.activities[id] === "Completed",
        ),
      ),
    ),
    plan = [];
  while (left.length) {
    const i = left.findIndex((x) =>
      x.prerequisites.every((id) => done.has(id)),
    );
    if (i < 0) break;
    const x = left.splice(i, 1)[0];
    plan.push({
      id: x.id,
      order: plan.length + 1,
      explanation: `Addresses ${x.addressed.map((s) => catalog.skills.find((k) => k.id === s).name).join(", ")}.`,
    });
    done.add(x.id);
  }
  return plan.length ? validatePlan(plan, state) : [];
}
module.exports = {
  catalog,
  items,
  itemById,
  initial,
  coverage,
  recommendations,
  conflicts,
  validateProfile,
  validateTimetable,
  validatePlan,
  localPlan,
  check,
  days,
};
