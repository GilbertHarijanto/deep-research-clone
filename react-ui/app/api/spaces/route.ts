import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { spaceStore } from "@/lib/spaceStore";
import { SpaceSnapshot } from "@/lib/spaceTypes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { topic, ideation = [], queries = [], findings = [], reportMarkdown = "", references = [] } = body || {};

  if (!topic) {
    return NextResponse.json({ error: "topic is required" }, { status: 400 });
  }

  const id = randomUUID();
  const snapshot: SpaceSnapshot = {
    id,
    topic,
    ideation,
    queries,
    findings,
    reportMarkdown,
    references,
    createdAt: new Date().toISOString(),
    assets: [],
    messages: [],
  };

  spaceStore.set(id, snapshot);
  return NextResponse.json({ id });
}
