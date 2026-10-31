import { randomInt } from "node:crypto";

// 31 characters: no 0 O 1 I L, which people misread. 10 of them ≈ 50 bits.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const LENGTH = 10;
const CODE_PATTERN = new RegExp(`^[${ALPHABET}]{${LENGTH}}$`);

/** A fresh tracking code, shown once as "XXXXX-XXXXX". */
export function newTrackingCode(): string {
  const raw = Array.from({ length: LENGTH }, () => ALPHABET.charAt(randomInt(ALPHABET.length))).join("");

  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

/** Uppercase without dashes or spaces, or null if it can't be a code. Hash this, never the raw input. */
export function normalizeTrackingCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s-]/g, "");

  return CODE_PATTERN.test(code) ? code : null;
}
