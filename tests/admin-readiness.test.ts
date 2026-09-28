import { describe, expect, it } from "vitest";
import { groupItems, policyDraftMarkers, scanPlaceholderCopy, scoreReadiness, statusFromCount } from "@/lib/admin/readiness";

describe("launch readiness scoring", () => {
  it("weights warnings as half a pass", () => {
    const s = scoreReadiness([{ status: "pass" }, { status: "warn" }, { status: "fail" }, { status: "pass" }]);
    expect(s.score).toBe(63); // (1 + 0.5 + 0 + 1) / 4
    expect(s.fail).toBe(1);
    expect(s.verdict).toBe("not_ready");
  });
  it("is ready only when everything passes", () => {
    expect(scoreReadiness([{ status: "pass" }]).verdict).toBe("ready");
    expect(scoreReadiness([{ status: "pass" }, { status: "warn" }]).verdict).toBe("almost");
    expect(scoreReadiness([]).score).toBe(0);
  });
  it("derives status from a count", () => {
    expect(statusFromCount(0, "fail")).toBe("pass");
    expect(statusFromCount(3, "warn")).toBe("warn");
  });
  it("groups items preserving order", () => {
    const g = groupItems([{ group: "A", id: 1 }, { group: "B", id: 2 }, { group: "A", id: 3 }]);
    expect(g.map((x) => [x.group, x.items.length])).toEqual([
      ["A", 2],
      ["B", 1],
    ]);
  });
});

describe("placeholder copy scan", () => {
  it("flags lorem ipsum, TODO markers and template slots", () => {
    expect(scanPlaceholderCopy("Lorem ipsum dolor")).toContain("lorem ipsum");
    expect(scanPlaceholderCopy("Price TBD")).toContain("TODO / TBD marker");
    expect(scanPlaceholderCopy("Shop coming soon")).toContain("“coming soon”");
    expect(scanPlaceholderCopy("[Insert artisan name]")).toContain("[insert …] template slot");
    expect(scanPlaceholderCopy("WAH BAYAAN MARKETPLACE")).toContain("template banner text");
  });
  it("does not flag real copy", () => {
    expect(scanPlaceholderCopy("Hand-knotted wool rug from Lahore, dyed with madder.", null, undefined)).toEqual([]);
    // "todo" in lower case inside a word is not a marker
    expect(scanPlaceholderCopy("Mastodon motif")).toEqual([]);
  });
  it("finds draft and pending policy pages", () => {
    expect(policyDraftMarkers("> Draft — pending legal review.")).toEqual(["Draft", "Pending", "Awaiting legal review"]);
    expect(policyDraftMarkers("Final terms.")).toEqual([]);
  });
});
