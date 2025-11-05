import { NextResponse } from "next/server";
import { addAsset, mustGetSpace } from "@/lib/spaceStore";
import { SpaceAsset } from "@/lib/spaceTypes";
import { randomUUID } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    mustGetSpace(params.id); // throws if missing

    const form = await req.formData();
    const file = form.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const ext = (file.name.split(".").pop() || "png").toLowerCase();

    const uploadsDir = join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });

    const filename = `${params.id}-${Date.now()}-${randomUUID()}.${ext}`;
    const filepath = join(uploadsDir, filename);
    await writeFile(filepath, bytes);

    const asset: SpaceAsset = {
      id: randomUUID(),
      kind: "image",
      url: `/uploads/${filename}`,
      createdAt: new Date().toISOString(),
    };

    addAsset(params.id, asset);
    return NextResponse.json(asset);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Upload failed" }, { status: 500 });
  }
}
