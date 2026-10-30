/** This workspace is private to this immutable GitHub account. */
export const ALLOWED_GITHUB_LOGIN = "erikivanov";
export const ALLOWED_GITHUB_ID = 60944586;
export type OwnerUser = { id: number; login: string; name: string; avatarUrl: string };
export function isAllowedGithubUser(value: unknown): value is { id: number; login: string; name?: string | null; avatar_url?: string; avatarUrl?: string; type?: string } {
  if (!value || typeof value !== "object") return false;
  const user = value as Record<string, unknown>;
  return user.id === ALLOWED_GITHUB_ID && typeof user.login === "string" && user.login.toLowerCase() === ALLOWED_GITHUB_LOGIN &&
    (user.type === undefined || user.type === "User");
}
