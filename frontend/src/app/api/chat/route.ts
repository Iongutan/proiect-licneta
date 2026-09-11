import { NextRequest, NextResponse } from "next/server";

// GET: Verifică dacă Ollama local este activ și ce modele sunt disponibile
export async function GET() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch("http://127.0.0.1:11434/api/tags", {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const models = data?.models?.map((m: any) => m.name) || [];
      const hasQwen = models.some((m: string) => m.toLowerCase().includes("qwen"));
      return NextResponse.json({
        connected: true,
        models,
        qwenLoaded: hasQwen,
        message: hasQwen ? "Ollama este activ cu modelul Qwen" : "Ollama este activ, dar modelul qwen3:14b nu este instalat",
      });
    }
  } catch {
    // offline
  }

  return NextResponse.json({
    connected: false,
    message: "Ollama este offline. Rulați: ollama run qwen3:14b",
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages = [], message, cityContext } = body;

    let chatMessages = Array.isArray(messages) && messages.length > 0 ? [...messages] : [];
    if (chatMessages.length === 0 && typeof message === "string" && message.trim().length > 0) {
      chatMessages = [{ role: "user", content: message.trim() }];
    }

    // Construire context de sistem pentru logistică Moldova
    let systemPrompt =
      "Ești Asistentul Inteligent Logistic OptiFleet B2B (bazat pe Qwen3 Local) pentru Republica Moldova. " +
      "Răspunzi concis, clar, profesional și direct în limba română la întrebările expeditorilor și cărăușilor. " +
      "Folosești coridoarele naționale M5, R1, R3, R6, calculezi economiile de grupaj (până la 62%) și capacitatea de 33 euro-paleți a camioanelor.";

    if (cityContext) {
      systemPrompt += ` Context actual: Hub ${cityContext.name}, distanță ${cityContext.distKm} km față de Chișinău, ${cityContext.pendingOrders} comenzi active, camion ${cityContext.truckPlate} (${cityContext.model}), transportator ${cityContext.carrier}, ${cityContext.freePallets} paleți disponibili.`;
    }

    // 1. Încercare apelare directă Ollama Qwen3:14b pe localhost:11434
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 secunde pentru model 14B

      const ollamaRes = await fetch("http://127.0.0.1:11434/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: "qwen3:14b",
          messages: [
            { role: "system", content: systemPrompt },
            ...chatMessages.map((m: { role: string; content: string }) => ({
              role: m.role,
              content: m.content,
            })),
          ],
          stream: false,
        }),
      });

      clearTimeout(timeoutId);

      if (ollamaRes.ok) {
        const data = await ollamaRes.json();
        const reply = data?.message?.content;
        if (reply && reply.trim().length > 0) {
          return NextResponse.json({
            connected: true,
            content: reply,
            source: "qwen3:14b-local",
          });
        }
      }
    } catch {
      // Ollama nu răspunde
    }

    // 2. Transparență totală cerută de utilizator: dacă Qwen nu e pornit, se returnează clar LIPSĂ DE CONEXIUNE
    return NextResponse.json({
      connected: false,
      source: "ollama-offline",
      error: "LIPSĂ DE CONEXIUNE: Serverul local Ollama nu este pornit pe portul 11434 sau modelul qwen3:14b nu este încărcat.",
      command: "ollama run qwen3:14b",
      content: "⚠️ LIPSĂ DE CONEXIUNE LA INTELIGENȚA ARTIFICIALĂ LOCALĂ (Ollama:11434)\n\nServiciul local Ollama nu răspunde pe portul 11434. Pentru a utiliza asistentul AI Qwen3 pe calculatorul dvs., porniți modelul rulând în terminal / PowerShell comanda:\n\nollama run qwen3:14b\n\nDupă ce modelul este încărcat, retrimiteți întrebarea.",
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : "Eroare internă";
    return NextResponse.json({ error }, { status: 500 });
  }
}
