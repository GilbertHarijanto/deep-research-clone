import { NextResponse } from "next/server";
import { addMessage, mustGetSpace } from "@/lib/spaceStore";
import { SpaceMessage, SpaceAsset } from "@/lib/spaceTypes";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ScopeInput = { nodeId: string; nodeType: "topic" | "idea" | "query" | "evidence" | "report" };

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    mustGetSpace(id);

    const body = await req.json().catch(() => ({}));
    const { text = "", attachments = [], scope } = body as {
      text?: string;
      attachments?: SpaceAsset[];
      scope?: ScopeInput;
    };

    if (!text && (!attachments || attachments.length === 0)) {
      return NextResponse.json({ error: "text or attachments required" }, { status: 400 });
    }

    const msg: SpaceMessage = {
      id: randomUUID(),
      role: "user",
      text,
      attachments,
      scope,
      createdAt: new Date().toISOString(),
    };

    addMessage(id, msg);
    return NextResponse.json(msg);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Failed to add message" }, { status: 500 });
  }
}
