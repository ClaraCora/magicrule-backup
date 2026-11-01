export const formatDate = (value: string | null | undefined, withTime = false) => {
  if (!value || !Number.isFinite(Date.parse(value))) return '未提供';
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false } : {}),
  }).format(new Date(value));
};
export const formatNumber = (value: number | null | undefined) => value == null ? '—' : new Intl.NumberFormat('zh-CN').format(value);
export const formatBytes = (value: number) => value >= 1024 ** 3 ? `${(value / 1024 ** 3).toFixed(2)} GB` : value >= 1024 ** 2 ? `${(value / 1024 ** 2).toFixed(1)} MB` : value >= 1024 ? `${(value / 1024).toFixed(1)} KB` : `${value} B`;
export const externalUrl = (value: string) => {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined; }
  catch { return undefined; }
};
export const base = import.meta.env.BASE_URL.replace(/\/$/, '');
