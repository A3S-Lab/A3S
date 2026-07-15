const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function formatTaskAge(createdAt: number, now = Date.now()) {
  const age = Math.max(0, now - createdAt);
  if (!Number.isFinite(createdAt) || age < MINUTE_MS) return '刚刚';
  if (age < HOUR_MS) return `${Math.floor(age / MINUTE_MS)}分钟前`;
  if (age < DAY_MS) return `${Math.floor(age / HOUR_MS)}小时前`;
  if (age < 7 * DAY_MS) return `${Math.floor(age / DAY_MS)}天前`;
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(createdAt);
}

export function taskCreatedAtLabel(createdAt: number) {
  if (!Number.isFinite(createdAt)) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(createdAt);
}
