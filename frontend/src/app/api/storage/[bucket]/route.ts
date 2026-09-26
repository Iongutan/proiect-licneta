import { NextResponse } from "next/server";
import { jsonError, rateLimited, requireUser, sameOrigin } from "@/lib/api-guard";
import { StorageError, readObject, saveObject } from "@/lib/server/storage";

// Încărcare (PUT) și citire (GET) de fișiere: /api/storage/<bucket>?path=<cale>.
// Accesul îl decid politicile RLS pe storage.objects, ca utilizatorul curent.

const MAX_BYTES = 10 * 1024 * 1024;

export async function PUT(request: Request, { params }: { params: Promise<{ bucket: string }> }) {
  if (!sameOrigin(request)) return jsonError(403, "Cerere respinsă.");
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  if (rateLimited(`upload:${auth.userId}`, 30, 60_000)) return jsonError(429, "Prea multe încărcări.");

  const { bucket } = await params;
  const name = new URL(request.url).searchParams.get("path") ?? "";
  const contentType = request.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BYTES) return jsonError(413, "Fișierul e prea mare.");
  const body = Buffer.from(await request.arrayBuffer());
  if (body.length === 0 || body.length > MAX_BYTES) return jsonError(413, "Fișier gol sau prea mare.");

  try {
    await saveObject(auth.userId, bucket, name, contentType, body);
    return NextResponse.json({ data: { path: name }, error: null });
  } catch (err) {
    if (err instanceof StorageError) return NextResponse.json({ data: null, error: { message: err.message, code: String(err.status) } }, { status: err.status });
    return NextResponse.json({ data: null, error: { message: "Fișierul nu a putut fi salvat.", code: "500" } }, { status: 500 });
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ bucket: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { bucket } = await params;
  const name = new URL(request.url).searchParams.get("path") ?? "";
  const file = await readObject(auth.userId, bucket, name);
  if (!file) return jsonError(404, "Fișier inexistent sau fără acces.");
  return new NextResponse(new Uint8Array(file.body), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
