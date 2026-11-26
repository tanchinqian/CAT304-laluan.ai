const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { Pool } = require("pg");
const { initial } = require("./domain");
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;
const dir = path.resolve(__dirname, "../../../.local-data");
const queues = new Map();
async function init() {
  if (pool)
    await pool.query(
      "CREATE TABLE IF NOT EXISTS student_state (uid TEXT PRIMARY KEY, state JSONB NOT NULL)",
    );
  else await fs.mkdir(dir, { recursive: true });
}
function file(uid) {
  return path.join(
    dir,
    crypto.createHash("sha256").update(uid).digest("hex") + ".json",
  );
}
async function read(uid) {
  if (pool) {
    const r = await pool.query("SELECT state FROM student_state WHERE uid=$1", [
      uid,
    ]);
    return r.rows[0]?.state || initial();
  }
  try {
    return JSON.parse(await fs.readFile(file(uid), "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") return initial();
    throw e;
  }
}
async function update(uid, revision, fn) {
  const previous = queues.get(uid) || Promise.resolve();
  const task = previous
    .catch(() => {})
    .then(async () => {
      const client = pool ? await pool.connect() : null;
      try {
        let state;
        if (client) {
          await client.query("BEGIN");
          await client.query(
            "INSERT INTO student_state(uid,state) VALUES($1,$2) ON CONFLICT DO NOTHING",
            [uid, initial()],
          );
          state = (
            await client.query(
              "SELECT state FROM student_state WHERE uid=$1 FOR UPDATE",
              [uid],
            )
          ).rows[0].state;
        } else state = await read(uid);
        if (state.revision !== revision) {
          const e = new Error(
            "Saved data changed. Reload your workspace before saving again.",
          );
          e.status = 409;
          throw e;
        }
        await fn(state);
        state.revision++;
        if (client) {
          await client.query("UPDATE student_state SET state=$2 WHERE uid=$1", [
            uid,
            state,
          ]);
          await client.query("COMMIT");
        } else {
          const temp = file(uid) + ".tmp";
          await fs.writeFile(temp, JSON.stringify(state));
          await fs.rename(temp, file(uid));
        }
        return state;
      } catch (e) {
        if (client) await client.query("ROLLBACK");
        throw e;
      } finally {
        client?.release();
      }
    });
  queues.set(uid, task);
  try {
    return await task;
  } finally {
    if (queues.get(uid) === task) queues.delete(uid);
  }
}
module.exports = { init, read, update, pool };
