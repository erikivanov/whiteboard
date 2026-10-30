import { NextRequest, NextResponse } from "next/server";
import { appOrigin, authCookieOptions, OAUTH_COOKIE, SESSION_COOKIE, revokeSession } from "@/lib/auth";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== appOrigin()) return NextResponse.json({ error: "Ungültiger Ursprung" }, { status: 403 });
  await revokeSession(request.cookies.get(SESSION_COOKIE)?.value);
  const response = NextResponse.redirect(`${appOrigin()}/`, 303);
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(SESSION_COOKIE, "", authCookieOptions(0));
  response.cookies.set(OAUTH_COOKIE, "", authCookieOptions(0));
  return response;
}
