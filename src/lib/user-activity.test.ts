import { describe, expect, it } from "vitest";
import { buildActivityMonitor, istToday, nowBucketFor, shiftDay } from "./user-activity";
import { generateSeed } from "@/lib/demo/seed";

describe("activity monitor", () => {
  const db = generateSeed();
  const today = istToday();
  // Yesterday is always a complete day, whatever the clock says now.
  const data = buildActivityMonitor(shiftDay(today, -1), db.activities, db.users.filter((u) => u.role !== "VIEWER"));

  it("has one row per staff member, busiest first", () => {
    expect(data.users).toHaveLength(7);
    for (let i = 1; i < data.users.length; i++) expect(data.users[i - 1].activeBuckets).toBeGreaterThanOrEqual(data.users[i].activeBuckets);
  });
  it("counts seeded staff actions into 10-minute slots", () => {
    const total = data.users.reduce((s, u) => s + u.total, 0);
    expect(total).toBeGreaterThan(20);
    expect(data.users[0].counts).toHaveLength(144);
    expect(data.users[0].counts.reduce((a, b) => a + b, 0)).toBe(data.users[0].total);
  });
  it("knows which slot now falls in", () => {
    expect(nowBucketFor(today)).not.toBeNull();
    expect(nowBucketFor("2030-01-01")).toBe(-1);
    expect(nowBucketFor("2020-01-01")).toBeNull();
  });
});
