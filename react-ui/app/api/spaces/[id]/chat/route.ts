import { NextResponse } from "next/server";
import OpenAI from "openai";
import { mustGetSpace, addMessage } from "@/lib/spaceStore";
import { SpaceMessage } from "@/lib/spaceTypes";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

function log(...args: any[]) {
  console.log("[/api/spaces/[id]/chat]", ...args);
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;

    log("Incoming chat POST for space:", id);

    const space = mustGetSpace(id);
    log("Loaded space:", space.topic);

    const recent = space.messages.slice(-20);
    log("Recent messages count:", recent.length);

    const systemMsg = {
      role: "system" as const,
      content: `You are a helpful research assistant for the space "${space.topic}".`,
    };

    const contextBlob = JSON.stringify(
      {
        topic: space.topic,
        ideation: space.ideation,
        queries: space.queries,
        reportMarkdown: (space.reportMarkdown ?? "").slice(0, 8000),
      },
      null,
      2
    );

    const ctxMsg = {
      role: "system" as const,
      content: `SPACE_CONTEXT:\n\n${contextBlob}`,
    };

    const history = recent.map((m) => ({
      role: m.role,
      content: m.text ?? "",
    }));

    log("Sending to OpenAI...", {
      system: systemMsg,
      ctxLength: contextBlob.length,
      messages: history.length,
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.6,
      messages: [systemMsg, ctxMsg, ...history],
    });

    log("OpenAI raw response:", completion);

    const text = completion.choices[0]?.message?.content?.trim() || "";
    log("Extracted response text:", text);

    const aiMsg: SpaceMessage = {
      id: randomUUID(),
      role: "assistant",
      text,
      createdAt: new Date().toISOString(),
    };

    addMessage(id, aiMsg);

    log("AI message saved:", aiMsg);

    return NextResponse.json(aiMsg);
  } catch (err) {
    log("ERROR OCCURRED:", err);
    return NextResponse.json(
      { error: (err as Error).message ?? "Chat failed" },
      { status: 500 }
    );
  }
}
