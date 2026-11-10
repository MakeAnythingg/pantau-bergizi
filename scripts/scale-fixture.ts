export const SCALE_KITCHENS = 30_000;
export const SCALE_SCHOOLS = 300_000;
export const SCALE_REPORTS = 5_000_000;
export const SCALE_DAYS = 30;
export const SCALE_DISTRICT = "Kabupaten Simulasi 1";
export const SCALE_KITCHEN = "SPPG Simulasi 1";
export const SCALE_CODE = "ABCDEFGHJK";
export const SCALE_NOW = new Date("2026-11-10T13:00:00+07:00");

export function localScaleUrl() {
  if (process.env.CI && process.env.CI !== "false") throw new Error("Scale scripts are for local use only.");

  const value = process.env.DATABASE_URL ?? "";
  const url = URL.parse(value);

  if (!url || !["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "localhost") {
    throw new Error("Set DATABASE_URL to a PostgreSQL database on localhost.");
  }

  return value;
}
