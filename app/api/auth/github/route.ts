import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { appOrigin, authCookieOptions, authKey, githubConfigured, OAUTH_COOKIE, signPayload } from "@/lib/auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const origin = appOrigin();
  if (!githubConfigured()) return NextResponse.redirect(`${origin}/?login=not_configured`);
  const state = randomBytes(32).toString("base64url"), verifier = randomBytes(32).toString("base64url");
  const redirectUri = `${origin}/api/auth/github/callback`;
  const url = new URL("https://github.com/login/oauth/authorize");
  url.search = new URLSearchParams({ client_id: process.env.GITHUB_CLIENT_ID!, redirect_uri: redirectUri,
    state, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256", allow_signup: "false" }).toString();
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(OAUTH_COOKIE, signPayload({ kind: "oauth", state, verifier, redirectUri, expiresAt: Date.now() + 600000 }, await authKey()), authCookieOptions(600));
  return response;
}
