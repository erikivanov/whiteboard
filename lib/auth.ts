import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile, readdir, unlink } from "node:fs/promises";
import path from "node:path";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { isAllowedGithubUser, OwnerUser } from "./auth-policy";

export const SESSION_COOKIE = "whiteboard_session";
export const OAUTH_COOKIE = "whiteboard_github_oauth";
export const SESSION_SECONDS = 60 * 60 * 24 * 7;
export type OAuthFlow = { kind: "oauth"; state: string; verifier: string; redirectUri: string; expiresAt: number };
type OwnerSession = OwnerUser & { kind: "session"; expiresAt: number; nonce?: string };
let keyPromise: Promise<Buffer> | undefined;

export function githubConfigured() { return !!process.env.GITHUB_CLIENT_ID?.trim() && !!process.env.GITHUB_CLIENT_SECRET?.trim(); }
export function appOrigin() {
  const url = new URL(process.env.APP_URL?.trim() || "http://localhost:3001");
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw Error("Ungültige APP_URL");
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw Error("APP_URL benötigt HTTPS");
  return url.origin;
}
export function authCookieOptions(maxAge: number) {
  return { httpOnly: true, sameSite: "lax" as const, secure: appOrigin().startsWith("https:"), path: "/", maxAge };
}
export async function authKey(): Promise<Buffer> {
  if (process.env.AUTH_SECRET) {
    if (Buffer.byteLength(process.env.AUTH_SECRET) < 32) throw Error("AUTH_SECRET muss mindestens 32 Bytes enthalten");
    return Buffer.from(process.env.AUTH_SECRET);
  }
  if (!keyPromise) keyPromise = (async () => {
    const directory = path.join(process.cwd(), ".data", "auth"), file = path.join(directory, "session.key");
    await mkdir(directory, { recursive: true, mode: 0o700 });
    try { await writeFile(file, randomBytes(48), { flag: "wx", mode: 0o600 }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
    const key = await readFile(file);
    if (key.length < 32) throw Error("Ungültiger Sitzungsschlüssel");
    return key;
  })();
  return keyPromise;
}
export function signPayload(payload: OAuthFlow | OwnerSession, key: Buffer) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", key).update(body).digest("base64url");
  return `${body}.${signature}`;
}
export function verifyPayload(value: string | undefined, key: Buffer, kind: "session" | "oauth", now = Date.now()): Record<string, unknown> | null {
  if (!value || value.length > 12000) return null;
  const parts = value.split(".");
  if (parts.length !== 2 || !parts.every(p => /^[A-Za-z0-9_-]+$/.test(p))) return null;
  const expected = createHmac("sha256", key).update(parts[0]).digest();
  const supplied = Buffer.from(parts[1], "base64url");
  if (supplied.toString("base64url") !== parts[1] || expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    if (!payload || payload.kind !== kind || typeof payload.expiresAt !== "number" || !Number.isSafeInteger(payload.expiresAt) || payload.expiresAt <= now || payload.expiresAt > now + (kind === "session" ? SESSION_SECONDS : 600) * 1000) return null;
    return payload;
  } catch { return null; }
}
export async function getOwner(request?: NextRequest): Promise<OwnerUser | null> {
  const value = request ? request.cookies.get(SESSION_COOKIE)?.value : (await cookies()).get(SESSION_COOKIE)?.value;
  if (!value) return null;
  const payload = verifyPayload(value, await authKey(), "session");
  if (!payload || !isAllowedGithubUser(payload)) return null;
  try { await readFile(revocationFile(value, (payload as unknown as { expiresAt: number }).expiresAt)); return null; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") return null; }
  return { id: payload.id, login: payload.login, name: typeof payload.name === "string" ? payload.name : payload.login,
    avatarUrl: typeof payload.avatarUrl === "string" && payload.avatarUrl.startsWith("https://avatars.githubusercontent.com/") ? payload.avatarUrl : "" };
}
export async function ownerSessionCookie(user: OwnerUser) {
  return signPayload({ ...user, kind: "session", nonce: randomBytes(24).toString("base64url"), expiresAt: Date.now() + SESSION_SECONDS * 1000 }, await authKey());
}

const revocationDirectory = () => path.join(process.cwd(), ".data", "auth", "revoked");
const revocationFile = (value: string, expiresAt: number) => path.join(revocationDirectory(), `${expiresAt}-${createHash("sha256").update(value).digest("hex")}`);
export async function revokeSession(value: string | undefined) {
  if (!value) return;
  const payload = verifyPayload(value, await authKey(), "session");
  if (!value || !payload || !isAllowedGithubUser(payload)) return;
  await mkdir(revocationDirectory(), { recursive: true, mode: 0o700 });
  await writeFile(revocationFile(value, (payload as unknown as { expiresAt: number }).expiresAt), "revoked", { mode: 0o600 });
  // Keep revocations across restarts, but discard them once the signed cookie expires.
  for (const name of await readdir(revocationDirectory())) {
    if (/^\d+-[a-f0-9]{64}$/.test(name) && Number(name.split("-")[0]) <= Date.now())
      await unlink(path.join(revocationDirectory(), name)).catch(() => {});
  }
}
