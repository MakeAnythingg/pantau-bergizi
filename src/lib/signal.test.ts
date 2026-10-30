import { expect, test } from "bun:test";
import { computeSignal, type SignalReport } from "./signal";

const exp = (o: Partial<SignalReport> = {}): SignalReport => ({
  schoolId: 1,
  schoolName: "SDN A",
  kind: "experience",
  reporterRole: "student",
  rating: 4,
  problems: ["none"],
  symptoms: [],
  subject: null,
  affectedCount: null,
  locationCheck: "inside",
  status: "received",
  duplicateOf: null,
  ...o,
});

const health = (o: Partial<SignalReport> = {}) =>
  exp({ kind: "health", rating: null, problems: [], symptoms: ["nausea"], subject: "self", ...o });

test("no reports → no_data", () => {
  expect(computeSignal([]).status).toBe("no_data");
});

test("reports without a rule → no_signal, with counts in the reason", () => {
  const s = computeSignal([exp(), exp({ schoolId: 2, schoolName: "SDN B" })]);
  expect(s.status).toBe("no_signal");
  expect(s.reason).toBe("2 laporan dari 2 sekolah, tidak ada keluhan keamanan pangan.");
});

test("3 health from 2 schools, 1 inside → priority (a)", () => {
  const s = computeSignal([
    health(),
    health({ locationCheck: "unavailable" }),
    health({ schoolId: 2, schoolName: "SDN B", locationCheck: "outside" }),
  ]);

  expect(s.status).toBe("priority");
  expect(s.label).toBe("Otomatis, belum ditinjau moderator");
  expect(s.reason).toBe("3 keluhan mual dari 2 sekolah dalam 24 jam, 1 dikirim dari area sekolah.");
});

test("priority (a) needs 3 reports, 2 schools and 1 inside", () => {
  const twoSchools = { schoolId: 2, schoolName: "SDN B" };
  expect(computeSignal([health(), health(twoSchools)]).status).toBe("attention");
  expect(computeSignal([health(), health(), health()]).status).toBe("attention");
  const outside = { locationCheck: "outside" as const };
  expect(computeSignal([health(outside), health(outside), health({ ...outside, ...twoSchools })]).status).toBe(
    "attention",
  );
});

test("rejected and duplicate reports don't count", () => {
  const s = computeSignal([
    health(),
    health({ schoolId: 2, schoolName: "SDN B" }),
    health({ status: "rejected" }),
    health({ duplicateOf: 7 }),
  ]);

  expect(s.status).toBe("attention");
});

test("mixed symptoms are named 'keluhan kesehatan'", () => {
  const s = computeSignal([health(), health({ symptoms: ["dizzy"] }), health({ schoolId: 2, schoolName: "SDN B" })]);
  expect(s.reason).toStartWith("3 keluhan kesehatan dari 2 sekolah");
});

test("reviewed teacher group report with ≥5 affected → priority (b)", () => {
  const group = health({ reporterRole: "teacher", subject: "group", affectedCount: 12, status: "reviewed" });
  const s = computeSignal([group]);
  expect(s.status).toBe("priority");
  expect(s.label).toBe("Ditinjau moderator");
  expect(s.reason).toBe("Laporan guru SDN A: perkiraan 12 terdampak.");
});

test("unreviewed teacher group report → attention, under review", () => {
  const s = computeSignal([health({ reporterRole: "teacher", subject: "group", affectedCount: 12 })]);
  expect(s.status).toBe("attention");
  expect(s.reason).toBe("Laporan guru SDN A: perkiraan 12 terdampak, sedang ditinjau moderator.");
});

test("one health report → attention naming the school", () => {
  expect(computeSignal([health(), exp()]).reason).toBe("1 keluhan mual dari SDN A.");
});

test("stale food counts inside the school area or once reviewed, not otherwise", () => {
  expect(computeSignal([exp({ problems: ["stale"] })]).status).toBe("attention");
  expect(
    computeSignal([exp({ problems: ["foreign_object"], locationCheck: "outside", status: "reviewed" })]).status,
  ).toBe("attention");
  expect(computeSignal([exp({ problems: ["stale"], locationCheck: "outside" })]).status).toBe("no_signal");
});

test("average rating below 3 needs at least 5 rated reports", () => {
  const low = Array.from({ length: 4 }, () => exp({ rating: 2 }));
  expect(computeSignal(low).status).toBe("no_signal");
  const s = computeSignal([...low, exp({ rating: 3 })]);
  expect(s.status).toBe("attention");
  expect(s.reason).toBe("Rata-rata nilai 2,2 dari 5 laporan.");
});

test("a reviewed teacher group report wins over a newer unreviewed one", () => {
  const group = { reporterRole: "teacher" as const, subject: "group" as const, affectedCount: 8 };
  const unreviewed = health({ ...group, schoolName: "SDN B" });
  const reviewed = health({ ...group, status: "reviewed" });
  expect(computeSignal([unreviewed, reviewed]).status).toBe("priority");
  expect(computeSignal([reviewed, unreviewed]).status).toBe("priority");
});
