/** Recognise YouTube / Vimeo links so they can be embedded through <ConsentEmbed>. */
export type VideoEmbed = { provider: "youtube" | "vimeo"; id: string; embedUrl: string; label: string };

export function parseVideoUrl(url: string | null | undefined): VideoEmbed | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.replace(/^(www\.|m\.)/, "");
  let yt: string | null = null;
  if (host === "youtu.be") yt = u.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "music.youtube.com") {
    if (u.pathname === "/watch") yt = u.searchParams.get("v");
    else {
      const m = u.pathname.match(/^\/(embed|shorts|live|v)\/([^/?#]+)/);
      yt = m?.[2] ?? null;
    }
  }
  if (yt && /^[A-Za-z0-9_-]{6,20}$/.test(yt)) {
    return { provider: "youtube", id: yt, embedUrl: `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0`, label: "YouTube" };
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = u.pathname.match(/(?:^|\/)(\d{5,12})(?:\/|$)/);
    if (m) return { provider: "vimeo", id: m[1], embedUrl: `https://player.vimeo.com/video/${m[1]}?autoplay=1&dnt=1`, label: "Vimeo" };
  }
  return null;
}
