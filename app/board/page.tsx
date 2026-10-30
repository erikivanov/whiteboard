import { redirect } from "next/navigation";
import Whiteboard from "@/components/Whiteboard";
import { getOwner } from "@/lib/auth";
export const dynamic = "force-dynamic";
export default async function BoardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  if (!params.board && !await getOwner()) redirect("/?login=required");
  return <Whiteboard />;
}
