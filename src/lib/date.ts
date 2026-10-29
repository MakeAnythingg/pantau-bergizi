const wibDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" });

/** Calendar day (YYYY-MM-DD) in WIB. */
export function todayWIB(now: Date = new Date()): string {
  return wibDay.format(now);
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The instant a WIB calendar day starts at the given hour. */
export function wibTime(day: string, hour = 0): Date {
  return new Date(`${day}T${String(hour).padStart(2, "0")}:00:00+07:00`);
}
