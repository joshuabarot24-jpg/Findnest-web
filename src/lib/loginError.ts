// Turns a number of seconds into "45 seconds", "12 minutes", "2 hours 5 minutes" or "2 days"
export function formatWait(totalSeconds: number): string {
  const s = Math.max(1, Math.ceil(totalSeconds));
  if (s < 60) return `${s} second${s === 1 ? "" : "s"}`;

  const m = Math.ceil(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"}`;

  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h < 24) {
    const hours = `${h} hour${h === 1 ? "" : "s"}`;
    return rem ? `${hours} ${rem} minute${rem === 1 ? "" : "s"}` : hours;
  }

  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? "" : "s"}`;
}

// The message shown on a login form when the request fails
export function loginErrorMessage(err: any): string {
  const res = err?.response;
  if (res?.status === 429 && res?.data?.retry_after) {
    return `Too many failed login attempts. Please try again in ${formatWait(res.data.retry_after)}.`;
  }
  return res?.data?.message || "Invalid credentials";
}