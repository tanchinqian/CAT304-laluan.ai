const { test } = require("node:test");
const assert = require("node:assert/strict");
const D = require("../src/domain");
const { generate } = require("../src/application");
test("Gemini rejects invalid IDs and preserves a previous plan, then accepts validated output", async (t) => {
  const oldKey = process.env.GEMINI_API_KEY,
    oldModel = process.env.GEMINI_MODEL;
  process.env.GEMINI_API_KEY = "test-fixture-key";
  process.env.GEMINI_MODEL = "test-fixture-model";
  t.after(() => {
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = oldKey;
    if (oldModel === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = oldModel;
  });
  const s = D.initial();
  s.profile.careerId = "software";
  s.profile.courses = ["DEMO101"];
  s.analysis = D.coverage(s);
  s.plan = D.localPlan(s);
  const prior = structuredClone(s.plan);
  let attempts = 0;
  const stub = t.mock.method(global, "fetch", async () => {
    attempts++;
    return Response.json({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  activities: [
                    {
                      id: "INVENTED",
                      order: 1,
                      explanation: "Not in catalogue",
                    },
                  ],
                }),
              },
            ],
          },
        },
      ],
    });
  });
  await generate(s, "gemini");
  assert.equal(attempts, 2);
  assert.deepEqual(s.plan, prior);
  assert.match(s.planStatus, /Awaiting refresh/);
  assert.equal(s.analysis.score, 25);
  stub.mock.mockImplementation(async () =>
    Response.json({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  activities: [
                    {
                      id: "DEMO202",
                      order: 1,
                      explanation: "Addresses REST APIs.",
                    },
                  ],
                }),
              },
            ],
          },
        },
      ],
    }),
  );
  await generate(s, "gemini");
  assert.equal(s.plan[0].id, "DEMO202");
  assert.match(s.planStatus, /validated/);
});
