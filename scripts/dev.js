const { spawn } = require("node:child_process");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const processes = [
  spawn(process.execPath, ["services/api/src/server.js"], {
    cwd: root,
    stdio: "inherit",
  }),
  spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "--config",
      "apps/web/vite.config.ts",
      "apps/web",
    ],
    { cwd: root, stdio: "inherit" },
  ),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const p of processes) p.kill();
  process.exitCode = code;
}
processes.forEach((p, index) => {
  const name = index === 0 ? "API" : "Web server";
  p.on("exit", (code, signal) => {
    if (!stopping) console.error(`${name} stopped (${signal || `exit ${code}`}). Shutting down the other service.`);
    stop(code ?? 1);
  });
  p.on("error", () => {
    console.error(`${name} could not start. Check the Node.js installation and dependencies.`);
    stop(1);
  });
});
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
