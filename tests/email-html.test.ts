import { describe, expect, it } from "vitest";
import { renderEmailHtml } from "@/lib/email-html";

describe("email html", () => {
  it("escapes content and turns a lone link into a button", () => {
    const html = renderEmailHtml("Reset <now>", "Hello <b>Ali</b>,\n\nhttps://x.test/reset?a=1&b=2\n\nSee https://x.test/faq for help.");
    expect(html).toContain("Reset &lt;now&gt;");
    expect(html).toContain("Hello &lt;b&gt;Ali&lt;/b&gt;");
    expect(html).toContain('href="https://x.test/reset?a=1&amp;b=2"');
    expect(html).toContain("Open link");
    expect(html).toContain('<a href="https://x.test/faq"');
    expect(html).not.toContain("<b>Ali</b>");
  });
});
