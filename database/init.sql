CREATE TABLE IF NOT EXISTS analysis_history (
  id BIGSERIAL PRIMARY KEY,
  firebase_uid TEXT,
  course_outcomes TEXT[] NOT NULL,
  required_skills TEXT[] NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS analysis_history_created_at_idx
  ON analysis_history (created_at DESC);

CREATE TABLE IF NOT EXISTS student_state (
  uid TEXT PRIMARY KEY,
  state JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS analysis_history_firebase_uid_idx
  ON analysis_history (firebase_uid);
