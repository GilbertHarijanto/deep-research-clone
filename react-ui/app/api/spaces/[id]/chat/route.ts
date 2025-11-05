import { NextResponse } from "next/server";
import OpenAI from "openai";
import { mustGetSpace, addMessage } from "@/lib/spaceStore";
import { SpaceMessage } from "@/lib/spaceTypes";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;           // ✅ await and use id
    const space = mustGetSpace(id);

    const recent = space.messages.slice(-20);

    const system = {
      role: "system" as const,
      content:
        `You are a helpful research assistant for the space "${space.topic}".\n\n` +
        `You have:\n- A research markdown report\n- References\n- A graph of topic → ideation → queries → findings\n\n` +
        `When relevant, ground answers in the space's report and references. Be concise, cite sources in-line (e.g., [1]).`,
    };

    const contextBlob = JSON.stringify(
      {
        topic: space.topic,
        ideation: space.ideation,
        queries: space.queries,
        findings: space.findings.slice(0, 20),
        references: space.references,
        reportMarkdown: (space.reportMarkdown ?? "").substring(0, 12000),
      },
      null,
      2
    );

    const ctxMsg = { role: "system" as const, content: `SPACE_CONTEXT\n\n${contextBlob}` };

    const history = recent.map((m) => ({
      role: m.role,
      content: (m.scope ? `(scope: ${m.scope.nodeType}#${m.scope.nodeId}) ` : "") + (m.text || "(attachment)"),
    })) as Array<{ role: "user" | "assistant" | "system"; content: string }>;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.6,
      messages: [system, ctxMsg, ...history],
    });

    const text = completion.choices[0]?.message?.content?.trim() || "…";

    const aiMsg: SpaceMessage = {
      id: randomUUID(),
      role: "assistant",
      text,
      createdAt: new Date().toISOString(),
    };

    addMessage(id, aiMsg);                      // ✅ use id
    return NextResponse.json(aiMsg);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Chat failed" }, { status: 500 });
  }
}
