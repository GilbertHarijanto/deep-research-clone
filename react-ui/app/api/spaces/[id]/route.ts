import { NextResponse } from "next/server";
import { mustGetSpace } from "@/lib/spaceStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  try {
    const space = mustGetSpace(id);
    return NextResponse.json(space);
  } catch {
    return NextResponse.json({ error: "Space not found" }, { status: 404 });
  }
}