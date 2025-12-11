import { NextResponse } from "next/server";
import { addMessage, mustGetSpace } from "@/lib/spaceStore";
import { SpaceMessage, SpaceAsset } from "@/lib/spaceTypes";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Add server-side logging helper
function log(...args: any[]) {
  console.log("[/api/spaces/[id]/messages]", ...args);
}

type ScopeInput = {
  nodeId: string;
  nodeType: "topic" | "idea" | "query" | "evidence" | "report" | "image";
  imageUrl?: string;
};

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;

    log("Incoming POST for space:", id);

    mustGetSpace(id);

    const body = await req.json().catch(() => null);

    log("Parsed body:", body);

    if (!body) {
      log("Invalid JSON body");
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const {
      text = "",
      attachments = [],
      scope,
    }: { text?: string; attachments?: SpaceAsset[]; scope?: ScopeInput } = body;

    if (!text && attachments.length === 0) {
      log("Missing text + attachments");
      return NextResponse.json(
        { error: "text or attachments required" },
        { status: 400 }
      );
    }

    const msg: SpaceMessage = {
      id: randomUUID(),
      role: "user",
      text,
      attachments,
      scope,
      createdAt: new Date().toISOString(),
    };

    log("Adding message to space:", msg);

    addMessage(id, msg);

    log("Message successfully stored.");

    return NextResponse.json(msg);
  } catch (e) {
    log("ERROR:", e);
    return NextResponse.json(
      { error: (e as Error).message || "Failed to add message" },
      { status: 500 }
    );
  }
}
