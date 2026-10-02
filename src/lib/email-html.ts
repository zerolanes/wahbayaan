/**
 * Renders a plain-text outbox email as simple, email-client-safe HTML: a
 * wordmark, the paragraphs, links turned into a button (first) or links, and a
 * short footer. Plain text is always sent alongside it.
 */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const URL_RE = /(https?:\/\/[^\s<]+)/g;

export function renderEmailHtml(subject: string, body: string) {
  const paragraphs = body.trim().split(/\n{2,}/);
  let buttonUsed = false;
  const blocks = paragraphs.map((p) => {
    const trimmed = p.trim();
    // A paragraph that is only a link becomes the call-to-action button (once).
    if (!buttonUsed && /^https?:\/\/\S+$/.test(trimmed)) {
      buttonUsed = true;
      return `<p style="margin:24px 0"><a href="${esc(trimmed)}" style="display:inline-block;background:#1f2b55;color:#fcfaf5;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600">Open link</a></p><p style="margin:0 0 16px;font-size:12px;color:#76644f;word-break:break-all">${esc(trimmed)}</p>`;
    }
    const html = esc(trimmed)
      .replace(URL_RE, (u) => `<a href="${u}" style="color:#8a3f25">${u}</a>`)
      .replace(/\n/g, "<br>");
    return `<p style="margin:0 0 16px">${html}</p>`;
  });
  return `<!doctype html><html><body style="margin:0;background:#f6efe3;padding:24px 12px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#2c2318;line-height:1.55;font-size:15px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;border:1px solid #e9e1d8">
<tr><td style="padding:24px 28px 8px;font-family:Georgia,serif;font-size:22px;color:#15192e">Wahbayaan <span style="font-size:15px;color:#9a6f2d">واہ بیان</span></td></tr>
<tr><td style="padding:8px 28px 4px"><h1 style="margin:0 0 16px;font-size:18px;font-weight:600;color:#15192e">${esc(subject)}</h1>${blocks.join("")}</td></tr>
<tr><td style="padding:16px 28px 24px;border-top:1px solid #f0e9df;font-size:12px;color:#76644f">Heritage craft from verified Pakistani artisans · payment held until your piece arrives.</td></tr>
</table></td></tr></table></body></html>`;
}
