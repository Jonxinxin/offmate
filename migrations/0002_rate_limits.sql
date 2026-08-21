-- 限流计数。注册/恢复码校验等低频敏感接口用，防脚本批量尝试。
-- 按固定窗口计数：窗口过期即重置，实现简单且对本产品足够。
CREATE TABLE rate_limits (
  key          TEXT PRIMARY KEY,
  count        INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);
