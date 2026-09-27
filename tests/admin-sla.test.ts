import { describe, expect, it } from "vitest";
import { ageLabel, disputeSla } from "@/lib/admin/sla";

const now = new Date("2026-06-10T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);

describe("dispute SLA", () => {
  it("labels ages compactly", () => {
    expect(ageLabel(0.2)).toBe("12m");
    expect(ageLabel(5)).toBe("5h");
    expect(ageLabel(72)).toBe("3d");
  });
  it("flags cases with no staff reply after a day", () => {
    const s = disputeSla({ createdAt: hoursAgo(30), status: "open", staffReplied: false }, now);
    expect(s.breached).toBe(true);
    expect(s.note).toBe("No staff reply yet");
  });
  it("warns as the resolve target approaches and breaches after five days", () => {
    expect(disputeSla({ createdAt: hoursAgo(80), status: "under_review", staffReplied: true }, now).tone).toBe("warning");
    expect(disputeSla({ createdAt: hoursAgo(130), status: "under_review", staffReplied: true }, now).breached).toBe(true);
    expect(disputeSla({ createdAt: hoursAgo(10), status: "open", staffReplied: false }, now).tone).toBe("gold");
  });
  it("measures resolved cases up to their resolution", () => {
    const s = disputeSla({ createdAt: hoursAgo(200), resolvedAt: hoursAgo(150), status: "resolved", staffReplied: true }, now);
    expect(s.label).toBe("2d");
    expect(s.tone).toBe("success");
  });
});
