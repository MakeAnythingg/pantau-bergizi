import { getEnv } from "./env";

/** The report form for a school, on the canonical site. Used by the QR, the share text, and the printed URL. */
export function formUrl(code: string, base: string = getEnv().PUBLIC_BASE_URL): string {
  return `${base}/lapor/${encodeURIComponent(code)}`;
}
