import { redirect } from "next/navigation";
import Dashboard from "@/components/Dashboard";
import { getOwner } from "@/lib/auth";
export const dynamic = "force-dynamic";
export default async function DashboardPage() {
  const owner = await getOwner();
  if (!owner) redirect("/?login=required");
  return <Dashboard user={owner} />;
}
