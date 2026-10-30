import { NextRequest, NextResponse } from "next/server";
import { getOwner, githubConfigured } from "@/lib/auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  return NextResponse.json({ user: await getOwner(request), configured: githubConfigured() }, { headers: { "Cache-Control": "private, no-store" } });
}
