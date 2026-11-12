// Allowed report times: 6:00 AM to 7:00 PM in 30-minute steps, never in the future (Manila time)
export function manilaNow() {
  const now = new Date();
  const m = new Date(now.getTime() + 8 * 60 * 60000 + now.getTimezoneOffset() * 60000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { date: `${m.getFullYear()}-${pad(m.getMonth() + 1)}-${pad(m.getDate())}`, minutes: m.getHours() * 60 + m.getMinutes() };
}

export function timeOptions(date: string): { value: string; label: string }[] {
  const now = manilaNow();
  const out: { value: string; label: string }[] = [];
  for (let m = 360; m <= 1140; m += 30) {
    if (date === now.date && m > now.minutes) continue;
    const h24 = Math.floor(m / 60);
    const min = m % 60;
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    out.push({
      value: `${String(h24).padStart(2, "0")}:${String(min).padStart(2, "0")}`,
      label: `${h12}:${String(min).padStart(2, "0")} ${h24 >= 12 ? "PM" : "AM"}`,
    });
  }
  return out;
}

// Exact-minute limits for a chosen date: 6:00 AM to 7:00 PM, and never later than now on today
export function timeBounds(date: string): { min: string; max: string; empty: boolean } {
  const now = manilaNow();
  const pad = (n: number) => String(n).padStart(2, "0");
  const maxMin = date === now.date ? Math.min(1140, now.minutes) : 1140;
  return { min: "06:00", max: `${pad(Math.floor(maxMin / 60))}:${pad(maxMin % 60)}`, empty: maxMin < 360 };
}

export function timeAllowed(date: string, value: string): boolean {
  if (!date || !/^\d{2}:\d{2}$/.test(value)) return false;
  const b = timeBounds(date);
  return !b.empty && value >= b.min && value <= b.max;
}