// v1: proxy Ollama neautentificat — eliminat din motive de securitate.
// Interpretarea căutărilor e acum în /api/intent (autentificat, limitat).
// Folderul poate fi șters (vezi README → Curățenie).
import { NextResponse } from "next/server";

const gone = () => NextResponse.json({ error: "Endpoint eliminat. Folosește /api/intent." }, { status: 410 });

export const GET = gone;
export const POST = gone;
