import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { eq, sql } from "drizzle-orm";
import { rateLimit, user } from "@/db/schema";
import { getTestDb, truncateAll } from "@/db/test-db";
import { keyedHash } from "./keyed-hash";
import {
  authenticate,
  currentSession,
  hashPassword,
  LOGIN_LIMITS,
  login,
  type Session,
  signSession,
  verifyPassword,
  verifySession,
} from "./auth";

const secret = "s".repeat(32);
const session: Session = { uid: 1, role: "moderator", sppgId: null, ver: 0, exp: 2_000_000_000 };

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

test("bumping session_version revokes existing sessions", async () => {
  const db = await getTestDb();
  const live = { ...(await moderatorSession()), exp: 2_000_000_000 };

  await db
    .update(user)
    .set({ sessionVersion: sql`${user.sessionVersion} + 1` })
    .where(eq(user.id, live.uid));

  expect(await currentSession(db, live)).toBeNull();
  expect(await currentSession(db, { ...(await moderatorSession()), exp: 2_000_000_000 })).not.toBeNull();
});

test("a signed session without `ver` (issued before revocation existed) is rejected", () => {
  const { ver: _ver, ...legacy } = session;
  const payload = b64url(JSON.stringify(legacy));
  const [, sig] = signSession(session, secret).split(".");

  expect(verifySession(`${payload}.${sig}`, secret, 1)).toBeNull();
});

describe("login throttling", () => {
  const MOD = "moderator@pantaubergizi.id";
  const at = new Date("2026-10-30T10:00:00Z");

  beforeEach(async () => {
    await (await getTestDb()).delete(rateLimit);
  });

  const fail = async (email: string, ip: string, times: number) => {
    for (let i = 0; i < times; i++) await login(await getTestDb(), email, "salah", keyedHash(ip), at);
  };

  test("blocks an email from one IP after 5 failures, even with the right password", async () => {
    await fail(MOD, "ip-a", LOGIN_LIMITS.emailIp.limit);

    expect(await login(await getTestDb(), MOD, "demo1234", keyedHash("ip-a"), at)).toEqual({
      ok: false,
      reason: "throttled",
    });
  });

  test("a stranger's failures don't lock the account for someone on another network", async () => {
    await fail(MOD, "ip-attacker", LOGIN_LIMITS.emailIp.limit);

    expect((await login(await getTestDb(), MOD, "demo1234", keyedHash("ip-judge"), at)).ok).toBe(true);
  });

  test("blocks an IP after 20 failures across many accounts", async () => {
    for (let i = 0; i < LOGIN_LIMITS.ip.limit; i++) await fail(`user${i}@x.id`, "ip-spray", 1);

    expect(await login(await getTestDb(), MOD, "demo1234", keyedHash("ip-spray"), at)).toEqual({
      ok: false,
      reason: "throttled",
    });
  });

  test("the window resets after 15 minutes", async () => {
    await fail(MOD, "ip-a", LOGIN_LIMITS.emailIp.limit);
    const later = new Date(at.getTime() + LOGIN_LIMITS.emailIp.windowSeconds * 1000);

    expect((await login(await getTestDb(), MOD, "demo1234", keyedHash("ip-a"), later)).ok).toBe(true);
  });

  test("a successful login clears that email's failures", async () => {
    await fail(MOD, "ip-a", LOGIN_LIMITS.emailIp.limit - 1);
    expect((await login(await getTestDb(), MOD, "demo1234", keyedHash("ip-a"), at)).ok).toBe(true);
    await fail(MOD, "ip-a", LOGIN_LIMITS.emailIp.limit - 1);

    expect((await login(await getTestDb(), MOD, "demo1234", keyedHash("ip-a"), at)).ok).toBe(true);
  });

  test("no raw IP or email is stored in rate-limit keys", async () => {
    await fail(MOD, "203.0.113.7", 1);
    const keys = (await (await getTestDb()).select().from(rateLimit)).map((r) => r.key).join(" ");

    expect(keys).not.toContain("moderator");
    expect(keys).not.toContain("203.0.113.7");
  });
});
