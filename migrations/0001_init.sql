-- OffMate 初始表结构
-- 时间字段统一为 Unix 秒；date 字段为 'YYYY-MM-DD'（Asia/Shanghai）

-- 用户：无平台账号体系，身份靠恢复码找回
CREATE TABLE users (
  id                 TEXT PRIMARY KEY,
  nickname           TEXT NOT NULL,
  avatar_emoji       TEXT,
  avatar_color       TEXT NOT NULL,
  recovery_code_hash TEXT NOT NULL UNIQUE,
  created_at         INTEGER NOT NULL,
  updated_at         INTEGER NOT NULL,
  last_seen_at       INTEGER NOT NULL
);
CREATE INDEX idx_users_recovery ON users(recovery_code_hash);

CREATE TABLE groups (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  owner_id      TEXT NOT NULL REFERENCES users(id),
  invite_code   TEXT NOT NULL UNIQUE,
  invite_expire INTEGER,
  member_count  INTEGER NOT NULL DEFAULT 1,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);
CREATE INDEX idx_groups_invite_code ON groups(invite_code);
CREATE INDEX idx_groups_owner ON groups(owner_id);

-- 成员关系，同时承载"我在这个群的可见范围"
CREATE TABLE memberships (
  id         TEXT PRIMARY KEY,
  group_id   TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'member',
  visibility TEXT NOT NULL DEFAULT 'full',
  joined_at  INTEGER NOT NULL,
  UNIQUE(group_id, user_id)
);
CREATE INDEX idx_memberships_user ON memberships(user_id);
CREATE INDEX idx_memberships_group ON memberships(group_id);

-- 作息记录：状态为"未设置"时不落库，查不到即未设置
CREATE TABLE schedules (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date       TEXT NOT NULL,
  status     TEXT NOT NULL,
  note       TEXT,
  source     TEXT NOT NULL DEFAULT 'manual',
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, date)
);
CREATE INDEX idx_schedules_date_user ON schedules(date, user_id);
CREATE INDEX idx_schedules_user_date ON schedules(user_id, date);

-- 排班规律：启用时物化生成未来 365 天的 schedules 记录
CREATE TABLE shift_rules (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  preset_key  TEXT,
  pattern     TEXT NOT NULL,
  anchor_date TEXT NOT NULL,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX idx_rules_user ON shift_rules(user_id, active);
