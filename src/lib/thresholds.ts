// Every number the signal rules use (PRD F2–F4, F8). Shown verbatim on /metode — change here only.

/** Signals count health reports received in the last N hours (server time). */
export const SIGNAL_WINDOW_HOURS = 24;

/** Prioritas (a): at least N health reports, from at least M schools, at least K sent from inside a school area. */
export const PRIORITY_MIN_HEALTH_REPORTS = 3;
export const PRIORITY_MIN_SCHOOLS = 2;
export const PRIORITY_MIN_INSIDE = 1;

/** Prioritas (b): a teacher/UKS group observation with at least N affected, once a moderator reviewed it. */
export const TEACHER_GROUP_MIN_AFFECTED = 5;

/** Perlu perhatian: average rating below N from at least M reports. Quality only, never a safety signal. */
export const LOW_RATING_THRESHOLD = 3;
export const LOW_RATING_MIN_REPORTS = 5;

/** Leftover share is shown only with at least N reports over the last M days. */
export const LEFTOVER_MIN_REPORTS = 10;
export const LEFTOVER_WINDOW_DAYS = 7;

/** "Dapur belum menjawab" after a Prioritas episode goes unanswered this long. */
export const RESPONSE_OVERDUE_HOURS = 24;

/** Demo radius for the "di area sekolah" location check. */
export const LOCATION_RADIUS_METERS = 150;

/** How far back a reporter may set the consumption date. */
export const CONSUMED_ON_MAX_BACKDATE_DAYS = 30;

export const NOTE_MAX_CHARS = 300;

/** Per-IP flood limits. High enough that a whole class on one school wifi can report (PRD F8: IP never blocks a class). */
export const REPORT_IP_LIMIT = { limit: 120, windowSeconds: 10 * 60 };
export const LACAK_IP_LIMIT = { limit: 30, windowSeconds: 10 * 60 };
