import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { appOrigin, authCookieOptions, authKey, githubConfigured, OAUTH_COOKIE, ownerSessionCookie, SESSION_COOKIE, SESSION_SECONDS, verifyPayload } from "@/lib/auth";
import { isAllowedGithubUser, OwnerUser } from "@/lib/auth-policy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const same = (a: string, b: string) => Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
function finish(location: string) {
  const response = NextResponse.redirect(new URL(location, appOrigin()));
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(OAUTH_COOKIE, "", authCookieOptions(0));
  return response;
}
export async function GET(request: NextRequest) {
  if (!githubConfigured()) return finish("/?login=not_configured");
  const flow = verifyPayload(request.cookies.get(OAUTH_COOKIE)?.value, await authKey(), "oauth");
  const state = request.nextUrl.searchParams.get("state"), code = request.nextUrl.searchParams.get("code");
  if (!flow || typeof flow.state !== "string" || typeof flow.verifier !== "string" || typeof flow.redirectUri !== "string" ||
    !state || !same(state, flow.state) || flow.redirectUri !== `${appOrigin()}/api/auth/github/callback`) return finish("/?login=invalid_state");
  if (request.nextUrl.searchParams.has("error")) return finish("/?login=cancelled");
  if (!code || code.length > 1000) return finish("/?login=failed");
  try {
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST", headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Whiteboard" },
      body: new URLSearchParams({ client_id: process.env.GITHUB_CLIENT_ID!, client_secret: process.env.GITHUB_CLIENT_SECRET!, code, redirect_uri: flow.redirectUri, code_verifier: flow.verifier }),
      cache: "no-store", signal: AbortSignal.timeout(10000),
    });
    const token = await tokenResponse.json();
    if (!tokenResponse.ok || typeof token.access_token !== "string" || token.error) return finish("/?login=failed");
    const userResponse = await fetch("https://api.github.com/user", {
      headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token.access_token}`, "User-Agent": "Whiteboard" },
      cache: "no-store", signal: AbortSignal.timeout(10000),
    });
    const profile: unknown = await userResponse.json();
    if (!userResponse.ok) return finish("/?login=failed");
    if (!isAllowedGithubUser(profile)) return finish("/?login=not_allowed");
    const user: OwnerUser = { id: profile.id, login: profile.login, name: typeof profile.name === "string" && profile.name ? profile.name : profile.login, avatarUrl: typeof profile.avatar_url === "string" ? profile.avatar_url : "" };
    const response = finish("/dashboard");
    response.cookies.set(SESSION_COOKIE, await ownerSessionCookie(user), authCookieOptions(SESSION_SECONDS));
    return response;
  } catch { return finish("/?login=failed"); }
}
