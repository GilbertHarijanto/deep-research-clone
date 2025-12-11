import { NextResponse } from "next/server";
import { addAsset, mustGetSpace } from "@/lib/spaceStore";
import { SpaceAsset } from "@/lib/spaceTypes";
import { randomUUID } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

function log(...args: any[]) {
  console.log("[/api/spaces/[id]/assets]", ...args);
}

/**
 * Analyze document using backend OCR and vision models
 */
async function analyzeDocument(
  fileUrl: string,
  fileName: string,
  spaceId: string,
  spaceTopic: string
): Promise<string> {
  try {
    log(`Analyzing document: ${fileName}`);

    const formData = new FormData();
    formData.append("question", "Extract and describe all text and content from this document.");

    // Determine if it's a PDF or image
    const isPdf = fileName.toLowerCase().endsWith(".pdf");
    if (isPdf) {
      formData.append("document_urls", fileUrl);
    } else {
      formData.append("image_urls", fileUrl);
    }

    formData.append("space_id", spaceId);
    formData.append("space_topic", spaceTopic);

    const response = await fetch(`${BACKEND_URL}/api/analyze`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      log(`Document analysis failed: ${response.statusText}`);
      return "";
    }

    const result = await response.json();
    log(`Analysis completed. Text length: ${result.text?.length || 0}`);
    return result.text || "";
  } catch (error) {
    log("Error analyzing document:", error);
    return "";
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const space = mustGetSpace(id); // throws if missing

    const form = await req.formData();
    const file = form.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const isPdf = ext === "pdf";

    const uploadsDir = join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });

    const filename = `${id}-${Date.now()}-${randomUUID()}.${ext}`;
    const filepath = join(uploadsDir, filename);
    await writeFile(filepath, bytes);

    const fileUrl = `/uploads/${filename}`;

    log(`File uploaded: ${filename}`);

    // Analyze the document using backend
    const extractedText = await analyzeDocument(
      `http://localhost:3000${fileUrl}`, // Full URL for backend to access
      filename,
      id,
      space.topic
    );

    const asset: SpaceAsset = {
      id: randomUUID(),
      kind: isPdf ? "doc" : "image",
      url: fileUrl,
      title: file.name,
      text: extractedText, // Store the extracted/analyzed text
      createdAt: new Date().toISOString(),
    };

    addAsset(id, asset);
    log(`Asset added with ${extractedText.length} chars of extracted text`);

    return NextResponse.json(asset);
  } catch (e) {
    log("Error:", e);
    return NextResponse.json({ error: (e as Error).message || "Upload failed" }, { status: 500 });
  }
}
