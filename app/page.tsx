import Home from "@/components/Home";
import { getOwner, githubConfigured } from "@/lib/auth";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  return <Home owner={await getOwner()} shared={typeof params.board === "string" && !!params.board} configured={githubConfigured()} error={typeof params.login === "string" ? params.login : undefined} />;
}
