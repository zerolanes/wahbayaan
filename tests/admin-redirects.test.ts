import { describe, expect, it } from "vitest";
import { chainedRules, normalizePath, normalizeTarget, resolveRedirect, validateRedirect } from "@/lib/admin/redirects";

describe("redirect paths", () => {
  it("normalises the way not-found.tsx looks paths up", () => {
    expect(normalizePath("/old/")).toBe("/old");
    expect(normalizePath("old?x=1#top")).toBe("/old");
    expect(normalizePath("https://wahbayaan.com/Old-Page/")).toBe("/Old-Page");
    expect(normalizePath("//a//b")).toBe("/a/b");
    expect(normalizePath("/")).toBe("/");
    expect(normalizeTarget("/shop/?sort=new")).toBe("/shop?sort=new");
    expect(normalizeTarget("https://example.com/x/")).toBe("https://example.com/x/");
  });
});

describe("resolveRedirect", () => {
  const rules = [
    { fromPath: "/a", toPath: "/b" },
    { fromPath: "/b", toPath: "/c" },
    { fromPath: "/x", toPath: "https://example.com" },
  ];
  it("follows chains and stops at external URLs", () => {
    expect(resolveRedirect("/a/", rules)).toMatchObject({ matched: true, final: "/c", loop: false });
    expect(resolveRedirect("/a", rules).hops).toHaveLength(2);
    expect(resolveRedirect("/x", rules)).toMatchObject({ final: "https://example.com", hops: [rules[2]] });
    expect(resolveRedirect("/nope", rules)).toMatchObject({ matched: false, final: "/nope" });
  });
  it("detects loops", () => {
    expect(resolveRedirect("/a", [{ fromPath: "/a", toPath: "/b" }, { fromPath: "/b", toPath: "/a" }]).loop).toBe(true);
  });
  it("lists chained rules", () => {
    expect(chainedRules(rules).map((r) => r.fromPath)).toEqual(["/a"]);
  });
});

describe("validateRedirect", () => {
  const existing = [{ fromPath: "/b", toPath: "/a" }];
  it("rejects self, loops, duplicates and reserved paths", () => {
    expect(validateRedirect({ fromPath: "/a", toPath: "/a/" }, [])).toMatch(/itself/);
    expect(validateRedirect({ fromPath: "/a", toPath: "/b" }, existing)).toMatch(/loop/);
    expect(validateRedirect({ fromPath: "/b/", toPath: "/c" }, existing)).toMatch(/already exists/);
    expect(validateRedirect({ fromPath: "/admin/x", toPath: "/c" }, [])).toMatch(/can't be redirected/);
    expect(validateRedirect({ fromPath: "/", toPath: "/c" }, [])).toMatch(/homepage/);
    expect(validateRedirect({ fromPath: "/a", toPath: "javascript:alert(1)" }, [])).toMatch(/destination/);
  });
  it("accepts ordinary and external rules", () => {
    expect(validateRedirect({ fromPath: "/old-rugs", toPath: "/category/rugs" }, existing)).toBeNull();
    expect(validateRedirect({ fromPath: "/press", toPath: "https://example.com/press" }, existing)).toBeNull();
  });
});
