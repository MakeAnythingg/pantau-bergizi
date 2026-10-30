import { beforeAll, expect, test } from "bun:test";
import { user } from "@/db/schema";
import { getTestDb, truncateAll } from "@/db/test-db";
import {
  authenticate,
  currentSession,
  hashPassword,
  type Session,
  signSession,
  verifyPassword,
  verifySession,
} from "./auth";

const secret = "s".repeat(32);
const session: Session = { uid: 1, role: "moderator", sppgId: null, exp: 2_000_000_000 };

function b64url(s: string) {
  return Buffer.from(s).toString("base64url");
}

test("password round-trip", async () => {
  const h = await hashPassword("rahasia");
  expect(await verifyPassword("rahasia", h)).toBe(true);
  expect(await verifyPassword("salah", h)).toBe(false);
});

test("same password hashes differently (salted)", async () => {
  expect(await hashPassword("rahasia")).not.toBe(await hashPassword("rahasia"));
});

test("session round-trips", () => {
  expect(verifySession(signSession(session, secret), secret, 1)).toEqual(session);
});

test("tampered payload rejected", () => {
  const [, sig] = signSession(session, secret).split(".");
  const forged = `${b64url(JSON.stringify({ ...session, role: "sppg_manager", sppgId: 9 }))}.${sig}`;
  expect(verifySession(forged, secret, 1)).toBeNull();
});

test("tampered signature rejected", () => {
  const token = signSession(session, secret);
  const flipped = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
  expect(verifySession(flipped, secret, 1)).toBeNull();
});

test("wrong secret rejected", () => {
  expect(verifySession(signSession(session, secret), "x".repeat(32), 1)).toBeNull();
});

test("expired rejected", () => {
  expect(verifySession(signSession(session, secret), secret, session.exp + 1)).toBeNull();
});

test("garbage rejected", () => {
  expect(verifySession("not-a-token", secret)).toBeNull();
  expect(verifySession("", secret)).toBeNull();
  expect(verifySession(`${b64url("not json")}.abc`, secret)).toBeNull();
});

/** Logs in the seeded moderator; throws so a failed login fails the test loudly. */
async function moderatorSession() {
  const s = await authenticate(await getTestDb(), "moderator@pantaubergizi.id", "demo1234");

  if (!s) throw new Error("moderator login failed");

  return s;
}

beforeAll(async () => {
  const db = await getTestDb();
  await truncateAll(db);
  await db
    .insert(user)
    .values({ email: "moderator@pantaubergizi.id", passwordHash: await hashPassword("demo1234"), role: "moderator" });
});

test("authenticate normalizes email", async () => {
  const db = await getTestDb();
  const s = await authenticate(db, "  Moderator@PantauBergizi.id ", "demo1234");
  expect(s).toMatchObject({ role: "moderator", sppgId: null });
});

test("authenticate rejects wrong password and unknown email", async () => {
  const db = await getTestDb();
  expect(await authenticate(db, "moderator@pantaubergizi.id", "salah")).toBeNull();
  expect(await authenticate(db, "nobody@pantaubergizi.id", "demo1234")).toBeNull();
});

test("currentSession keeps a session whose account is unchanged", async () => {
  const db = await getTestDb();
  const s = await moderatorSession();
  const live = { ...s, exp: 2_000_000_000 };
  expect(await currentSession(db, live)).toEqual(live);
});

test("currentSession drops a session whose account was deleted or changed", async () => {
  const db = await getTestDb();
  const s = await moderatorSession();
  expect(await currentSession(db, { ...s, uid: 9999, exp: 2_000_000_000 })).toBeNull();
  expect(await currentSession(db, { ...s, role: "sppg_manager", sppgId: 1, exp: 2_000_000_000 })).toBeNull();
});
