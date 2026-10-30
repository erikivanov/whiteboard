import type { OwnerUser } from "@/lib/auth-policy";
import Dashboard from "./Dashboard";
import Whiteboard from "./Whiteboard";
import LoginPage from "./LoginPage";

export default function Home({ owner, shared, configured, error }: { owner: OwnerUser | null; shared: boolean; configured: boolean; error?: string }) {
  if (shared) return <Whiteboard />;
  return owner ? <Dashboard user={owner} /> : <LoginPage configured={configured} error={error} />;
}
