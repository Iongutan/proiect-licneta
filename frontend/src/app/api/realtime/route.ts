import { requireUser } from "@/lib/api-guard";
import { subscribe } from "@/lib/server/realtime";

// Server-Sent Events: /api/realtime?tables=vehicles,notifications
// Fiecare eveniment conține rândul exact cum îl vede utilizatorul (RLS).

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const tables = (new URL(request.url).searchParams.get("tables") ?? "").split(",").filter(Boolean).slice(0, 10);

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let keepAlive: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (text: string) => {
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          // conexiunea s-a închis între timp
        }
      };
      write("retry: 3000\n\n");
      unsubscribe = await subscribe(auth.userId, tables, (event) => write(`data: ${JSON.stringify(event)}\n\n`));
      keepAlive = setInterval(() => write(": ping\n\n"), 25_000);
      request.signal.addEventListener("abort", () => {
        unsubscribe?.();
        if (keepAlive) clearInterval(keepAlive);
        try {
          controller.close();
        } catch {
          // deja închis
        }
      });
    },
    cancel() {
      unsubscribe?.();
      if (keepAlive) clearInterval(keepAlive);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
