import { NextResponse, type NextRequest } from "next/server";

const VISITOR_COOKIE = "wb_visitor";
const DESTINATION_COOKIE = "wb_dest";
const SUPPORTED_DESTINATIONS = new Set(["US", "GB", "CA", "PK"]);

/**
 * Gives every browser a stable anonymous visitor id (guest cart and wishlist)
 * and a first guess at the buyer's destination from the host's geo header.
 * The id is also written onto the incoming request so the very first render
 * already sees it.
 */
export function proxy(request: NextRequest) {
  const setOnRequest: Record<string, string> = {};

  if (!request.cookies.get(VISITOR_COOKIE)) setOnRequest[VISITOR_COOKIE] = crypto.randomUUID();

  if (!request.cookies.get(DESTINATION_COOKIE)) {
    const geo = request.headers.get("x-vercel-ip-country") ?? request.headers.get("cf-ipcountry");
    if (geo && SUPPORTED_DESTINATIONS.has(geo.toUpperCase())) setOnRequest[DESTINATION_COOKIE] = geo.toUpperCase();
  }

  for (const [name, value] of Object.entries(setOnRequest)) request.cookies.set(name, value);
  // Lets not-found.tsx look up admin-managed redirects for the requested path.
  request.headers.set("x-wb-path", request.nextUrl.pathname);
  const response = NextResponse.next({ request: { headers: request.headers } });
  for (const [name, value] of Object.entries(setOnRequest)) {
    response.cookies.set(name, value, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365, httpOnly: name === VISITOR_COOKIE });
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/|art/|brand-art/|media/|brand/|demo/|favicon|robots.txt|sitemap.xml).*)"],
};
