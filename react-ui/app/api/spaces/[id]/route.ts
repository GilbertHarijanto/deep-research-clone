import { NextResponse } from "next/server";
import { mustGetSpace } from "@/lib/spaceStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const space = mustGetSpace(params.id);
    return NextResponse.json(space);
  } catch {
    return NextResponse.json({ error: "Space not found" }, { status: 404 });
  }
}
