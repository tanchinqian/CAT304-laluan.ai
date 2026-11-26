const { test } = require("node:test");
const assert = require("node:assert/strict");
const net = require("node:net");

test("API rejects an occupied port instead of reporting a successful start", async () => {
  // Isolate startup settings from a developer's real Firebase/database credentials.
  process.env.AUTH_REQUIRED = "false";
  process.env.DATABASE_URL = "";
  process.env.API_HOST = "127.0.0.1";
  const blocker = net.createServer();
  await new Promise((resolve, reject) => {
    blocker.once("error", reject);
    blocker.listen(0, "127.0.0.1", resolve);
  });
  process.env.API_PORT = String(blocker.address().port);
  const { start } = require("../src/application");
  try {
    await assert.rejects(start(), { code: "EADDRINUSE" });
  } finally {
    await new Promise(resolve => blocker.close(resolve));
  }
});
