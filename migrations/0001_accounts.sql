-- Accounts, one-time login links, sessions, and saved rolls.
-- A roll with no account is anonymous. SQLite treats those null account ids as distinct,
-- so each anonymous generate can add a row. A real account stays unique per UTC day.
-- Score is a digit string so rank can use length(score), then the digits.

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  username TEXT UNIQUE,
  username_key TEXT UNIQUE,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS login_links (
  token TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS rolls (
  id TEXT PRIMARY KEY,
  account_id TEXT REFERENCES accounts(id),
  username TEXT NOT NULL,
  word TEXT NOT NULL,
  score TEXT NOT NULL,
  played_at INTEGER NOT NULL,
  utc_day TEXT NOT NULL,
  UNIQUE (account_id, utc_day)
);

CREATE INDEX IF NOT EXISTS rolls_played_at ON rolls (played_at);
CREATE INDEX IF NOT EXISTS rolls_utc_day ON rolls (utc_day);
