const { test } = require("node:test");
const assert = require("node:assert/strict");
const D = require("../src/domain");
test("coverage uses unique accepted skills, completed status only, and role denominator", () => {
  const s = D.initial();
  assert.equal(D.coverage(s), null);
  s.profile.careerId = "software";
  assert.equal(D.coverage(s).score, 0);
  s.profile.courses = ["DEMO101"];
  s.activities = { DEMO202: "Pending", "EXT-SQL": "In Progress" };
  assert.equal(D.coverage(s).score, 25);
  s.activities["DEMO202"] = "Completed";
  assert.equal(D.coverage(s).score, 50);
  s.profile.courses.push("DEMO202");
  assert.equal(D.coverage(s).score, 50);
  s.profile.careerId = "data";
  assert.equal(D.coverage(s).score, 25);
});
test("catalogue identifiers and timetable boundaries are validated", () => {
  assert.throws(() =>
    D.validateProfile({
      programme: "A",
      year: "1",
      careerId: "software",
      courses: ["fake"],
    }),
  );
  assert.throws(() =>
    D.validateTimetable(
      [
        {
          course: "CAT304",
          group: "A",
          day: "Monday",
          start: "11:00",
          end: "10:00",
        },
      ],
      "2026/27-1",
    ),
  );
  const s = D.initial();
  s.timetable = D.validateTimetable(
    [
      {
        course: "CAT304",
        group: "A",
        day: "Monday",
        start: "09:00",
        end: "10:00",
      },
    ],
    s.semester,
  );
  const x = { ...D.itemById("DEMO202"), kind: "course" };
  assert.equal(D.conflicts(x, s)[0].status, "No conflict detected");
  s.timetable[0].end = "10:30";
  assert.equal(D.conflicts(x, s)[0].status, "Timetable conflict");
  assert.match(D.conflicts(x, s)[0].overlaps[0], /CAT304/);
  s.semester = "2027";
  assert.equal(D.conflicts(x, s)[0].status, "Timetable not checked");
});
test("recommendations and generated plans enforce prerequisites, IDs and uniqueness", () => {
  const s = D.initial();
  s.profile.careerId = "software";
  s.analysis = D.coverage(s);
  assert.throws(() =>
    D.validatePlan([{ id: "DEMO202", order: 1, explanation: "API" }], s),
  );
  assert.throws(() =>
    D.validatePlan([{ id: "fake", order: 1, explanation: "bad" }], s),
  );
  assert.throws(() =>
    D.validatePlan(
      [
        { id: "EXT-SQL", order: 1, explanation: "SQL" },
        { id: "EXT-SQL", order: 2, explanation: "repeat" },
      ],
      s,
    ),
  );
  s.profile.courses = ["DEMO101"];
  s.analysis = D.coverage(s);
  assert.ok(!D.recommendations(s).some((x) => x.id === "DEMO101"));
  assert.ok(D.localPlan(s).length > 0);
  assert.doesNotThrow(() => D.validatePlan(D.localPlan(s), s));
  s.activities = { "EXT-API": "Pending" };
  assert.deepEqual(
    D.localPlan(s).map((x) => x.id),
    ["EXT-API"],
  );
  assert.throws(
    () => D.validatePlan([{ id: "EXT-SQL", order: 1, explanation: "SQL" }], s),
    /omitted a selected/,
  );
});
