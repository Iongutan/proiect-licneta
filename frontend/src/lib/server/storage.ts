import "server-only";

// Fișiere încărcate (dovezi foto K11, documente KYC). Conținutul stă pe disc în
// .data/storage/<bucket>/<cale>; evidența în storage.objects, unde RLS decide
// cine poate încărca și cine poate citi — aceleași politici ca înainte (06, 10).

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { asUser, dataDir } from "./db";

const SEGMENT = /^[A-Za-z0-9._-]+$/;
const BUCKET = /^[a-z0-9-]{3,63}$/;

export function validObjectPath(bucket: string, name: string): boolean {
  if (!BUCKET.test(bucket)) return false;
  const parts = name.split("/");
  return parts.length >= 1 && parts.length <= 6 && parts.every((p) => SEGMENT.test(p) && p !== "." && p !== "..");
}

function diskPath(bucket: string, name: string): string {
  const root = path.join(dataDir(), "storage");
  const full = path.resolve(root, bucket, ...name.split("/"));
  if (!full.startsWith(path.resolve(root) + path.sep)) throw new Error("Cale invalidă.");
  return full;
}

export class StorageError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function saveObject(userId: string, bucket: string, name: string, contentType: string, body: Buffer): Promise<void> {
  if (!validObjectPath(bucket, name)) throw new StorageError("Cale de fișier invalidă.", 400);
  const target = diskPath(bucket, name);
  const tmp = `${target}.${randomUUID()}.part`;

  await asUser(userId, async (c) => {
    const b = (await c.query<{ file_size_limit: string | null; allowed_mime_types: string[] | null }>(
      "select file_size_limit, allowed_mime_types from storage.buckets where id = $1", [bucket])).rows[0];
    if (!b) throw new StorageError("Spațiu de stocare inexistent.", 404);
    if (b.file_size_limit && body.length > Number(b.file_size_limit)) throw new StorageError("Fișierul e prea mare.", 413);
    if (b.allowed_mime_types?.length && !b.allowed_mime_types.includes(contentType)) throw new StorageError("Tip de fișier nepermis.", 415);

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(tmp, body, { flag: "wx" });
    try {
      // RLS (politicile de INSERT pe storage.objects) decide dacă utilizatorul are voie.
      await c.query("insert into storage.objects (bucket_id, name, metadata) values ($1, $2, $3)",
        [bucket, name, JSON.stringify({ mimetype: contentType, size: body.length })]);
      fs.renameSync(tmp, target);
    } catch (err) {
      fs.rmSync(tmp, { force: true });
      const e = err as { code?: string };
      if (e.code === "23505") throw new StorageError("Fișierul există deja.", 409);
      if (e.code === "42501") throw new StorageError("Nu ai drepturi să încarci aici.", 403);
      throw err;
    }
  });
}

export async function readObject(userId: string, bucket: string, name: string): Promise<{ body: Buffer; contentType: string } | null> {
  if (!validObjectPath(bucket, name)) return null;
  const meta = await asUser(userId, async (c) =>
    (await c.query<{ metadata: { mimetype?: string } }>(
      "select metadata from storage.objects where bucket_id = $1 and name = $2", [bucket, name])).rows[0]);
  if (!meta) return null;
  const file = diskPath(bucket, name);
  if (!fs.existsSync(file)) return null;
  return { body: fs.readFileSync(file), contentType: meta.metadata?.mimetype ?? "application/octet-stream" };
}
