import type { BrowserContext } from "@playwright/test";
import { createHmac, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ALLOWED_GITHUB_ID, ALLOWED_GITHUB_LOGIN } from "../lib/auth-policy";

/** Test-only session fixture. There is deliberately no test-login HTTP endpoint. */
export async function ownerTestCookie(baseURL = "http://localhost:3001") {
  let secret = process.env.AUTH_SECRET;
  if (!secret) {
    for (const name of [".env.development.local", ".env.local", ".env.development", ".env"]) {
      try {
        const text = await readFile(path.join(process.cwd(), name), "utf8");
        const value = text.match(/^\s*AUTH_SECRET\s*=\s*(.+)\s*$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, "");
        if (value) { secret = value; break; }
      } catch {}
    }
  }
  let key: Buffer;
  if (secret) key = Buffer.from(secret);
  else {
    const directory = path.join(process.cwd(), ".data", "auth"), file = path.join(directory, "session.key");
    await mkdir(directory, { recursive: true, mode: 0o700 });
    try { await writeFile(file, randomBytes(48), { flag: "wx", mode: 0o600 }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
    key = await readFile(file);
  }
  const body = Buffer.from(JSON.stringify({ kind: "session", id: ALLOWED_GITHUB_ID, login: ALLOWED_GITHUB_LOGIN, name: "Owner test fixture", avatarUrl: "", expiresAt: Date.now() + 600000 })).toString("base64url");
  return { name: "whiteboard_session", value: body + "." + createHmac("sha256", key).update(body).digest("base64url"),
    domain: new URL(baseURL).hostname, path: "/", httpOnly: true, sameSite: "Lax" as const, secure: baseURL.startsWith("https:"), expires: Math.floor(Date.now() / 1000) + 600 };
}
export async function authenticateContext(context: BrowserContext, baseURL?: string) { await context.addCookies([await ownerTestCookie(baseURL)]); }
