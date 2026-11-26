const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const base = process.env.API_TEST_URL;
test(
  "HTTP persistence, isolation, validation, completion and conflict refresh",
  { skip: !base },
  async () => {
    const session = randomUUID();
    async function req(path, method = "GET", body, headers = {}) {
      const r = await fetch(base + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-dev-session": session,
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: r.status, data: await r.json() };
    }
    let s = (await req("/api/workspace")).data;
    assert.equal(s.revision, 0);
    let r = await req("/api/profile", "PUT", {
      revision: s.revision,
      profile: {
        programme: "Computing",
        year: "2",
        careerId: "software",
        courses: ["DEMO101", "DEMO101"],
      },
    });
    assert.equal(r.status, 200);
    s = r.data;
    assert.equal(s.profile.courses.length, 1);
    assert.equal(s.analysis.score, 25);
    assert.equal(
      (
        await req("/api/workspace", "GET", undefined, {
          "x-dev-session": randomUUID(),
        })
      ).data.profile.careerId,
      "",
    );
    assert.equal(
      (await req("/api/profile", "PUT", { revision: 0, profile: s.profile }))
        .status,
      409,
    );
    r = await req("/api/activities", "PUT", {
      revision: s.revision,
      ids: ["EXT-SQL"],
    });
    assert.equal(r.status, 200);
    s = r.data;
    assert.equal(s.analysis.score, 25);
    r = await req("/api/activity", "PATCH", {
      revision: s.revision,
      id: "EXT-SQL",
      status: "Completed",
    });
    assert.equal(r.status, 200);
    s = r.data;
    assert.equal(s.analysis.score, 75);
    const count = s.snapshots.length;
    r = await req("/api/timetable", "PUT", {
      revision: s.revision,
      semester: "2026/27-1",
      timetable: [
        {
          course: "CAT304",
          group: "A",
          day: "Monday",
          start: "10:00",
          end: "11:00",
        },
      ],
    });
    assert.equal(r.status, 200);
    s = r.data;
    assert.equal(s.analysis.score, 75);
    assert.equal(s.snapshots.length, count);
    assert.equal(
      s.recommendations.find((x) => x.id === "DEMO202").conflicts[0].status,
      "Timetable conflict",
    );
    assert.equal(
      (
        await req("/api/timetable", "PUT", {
          revision: s.revision,
          semester: "2026/27-1",
          timetable: [
            {
              course: "Bad",
              group: "A",
              day: "Monday",
              start: "11:00",
              end: "10:00",
            },
          ],
        })
      ).status,
      400,
    );
    r = await req("/api/plan", "POST", { revision: s.revision, mode: "local" });
    assert.equal(r.status, 200);
    s = r.data;
    assert.match(s.planStatus, /Local preview/);
    assert.ok(s.plan.length);
    r = await req("/api/profile", "PUT", {
      revision: s.revision,
      profile: { ...s.profile, careerId: "data" },
    });
    assert.equal(r.status, 200);
    s = r.data;
    assert.equal(s.analysis.score, 50);
    assert.ok(s.snapshots.some((x) => x.careerId === "software"));
    assert.ok(s.snapshots.some((x) => x.careerId === "data"));
    const saved = (await req("/api/workspace")).data;
    assert.equal(saved.revision, s.revision);
    assert.equal(saved.timetable[0].course, "CAT304");
    assert.equal(
      (
        await req("/api/workspace", "GET", undefined, {
          "x-dev-session": "invalid",
        })
      ).status,
      401,
    );
  },
);
