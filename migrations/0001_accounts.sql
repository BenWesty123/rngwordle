-- Accounts, one-time login links, the tabs waiting on them, sessions, and saved rolls.
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

CREATE TABLE IF NOT EXISTS login_waits (
  wait_hash TEXT PRIMARY KEY,
  link_token TEXT NOT NULL,
  device TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  approved_at INTEGER,
  claimed_at INTEGER
);

CREATE INDEX IF NOT EXISTS login_waits_link ON login_waits (link_token);

CREATE TABLE IF NOT EXISTS friendships (
  id TEXT PRIMARY KEY,
  requester_id TEXT NOT NULL REFERENCES accounts(id),
  addressee_id TEXT NOT NULL REFERENCES accounts(id),
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  pair_lo TEXT NOT NULL,
  pair_hi TEXT NOT NULL,
  UNIQUE (pair_lo, pair_hi)
);

CREATE INDEX IF NOT EXISTS friendships_requester ON friendships (requester_id);
CREATE INDEX IF NOT EXISTS friendships_addressee ON friendships (addressee_id);

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

-- Leaderboards rank by score: longer digit strings first, then the digits, then the earlier roll.
-- These indexes let a board read just the rows it shows instead of sorting every roll.
CREATE INDEX IF NOT EXISTS rolls_rank ON rolls (length(score) DESC, score DESC, played_at);
CREATE INDEX IF NOT EXISTS rolls_day_rank ON rolls (utc_day, length(score) DESC, score DESC, played_at);

-- A guest browser's one leaderboard roll per UTC day. Only a hash of its cookie is kept.
CREATE TABLE IF NOT EXISTS guest_days (
  guest_hash TEXT NOT NULL,
  utc_day TEXT NOT NULL,
  roll_id TEXT NOT NULL,
  PRIMARY KEY (guest_hash, utc_day)
);

-- Login emails asked for per visitor per UTC day, so the form can't be used to spam.
CREATE TABLE IF NOT EXISTS login_requests (
  ip_hash TEXT NOT NULL,
  utc_day TEXT NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (ip_hash, utc_day)
);
