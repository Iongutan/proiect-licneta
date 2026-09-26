"""Interpretare de intenție cu Qwen3 local (Ollama), pentru căutările pe care
parserul determinist din frontend nu le înțelege.

Ieșirea modelului e constrânsă la o schemă JSON și validată: locurile trebuie
să fie din lista cunoscută, altfel sunt ignorate. Modelul nu are unelte și nu
vede date din baza de date, deci un prompt malițios nu poate face altceva decât
să întoarcă un JSON invalid.
"""
import json
import logging

import httpx

from .schemas import IntentRequest, IntentResponse

log = logging.getLogger(__name__)

_SCHEMA = {
    "type": "object",
    "properties": {
        "origin": {"type": ["string", "null"]},
        "destination": {"type": ["string", "null"]},
        "pallets": {"type": ["integer", "null"]},
        "with_transit": {"type": "boolean"},
    },
    "required": ["origin", "destination", "pallets", "with_transit"],
}

_SYSTEM = (
    "Extragi dintr-o căutare de transport marfă din Republica Moldova: localitatea de "
    "plecare (origin), localitatea de destinație (destination), numărul de paleți (pallets) "
    "și dacă utilizatorul acceptă vehicule în tranzit (with_transit). Răspunzi DOAR cu JSON. "
    "Folosește exact denumirile din lista de locuri cunoscute; dacă nu găsești, pune null."
)


class IntentUnavailable(RuntimeError):
    pass


def _match_place(value: object, known: list[str]) -> str | None:
    if not isinstance(value, str) or not value.strip():
        return None
    if not known:
        return value.strip()[:80]
    lowered = {k.lower(): k for k in known}
    return lowered.get(value.strip().lower())


async def parse_intent(req: IntentRequest, base_url: str, model: str, timeout_s: float) -> IntentResponse:
    places = ", ".join(req.known_places) if req.known_places else "(orice localitate din Moldova)"
    body = {
        "model": model,
        "stream": False,
        "think": False,
        "format": _SCHEMA,
        "options": {"temperature": 0},
        "messages": [
            {"role": "system", "content": f"{_SYSTEM}\nLocuri cunoscute: {places}"},
            {"role": "user", "content": req.query},
        ],
    }
    try:
        async with httpx.AsyncClient(base_url=base_url, timeout=timeout_s) as client:
            resp = await client.post("/api/chat", json=body)
            resp.raise_for_status()
            raw = json.loads(resp.json()["message"]["content"])
    except (httpx.HTTPError, KeyError, json.JSONDecodeError) as exc:
        log.warning("Qwen3 indisponibil sau răspuns invalid: %s", exc)
        raise IntentUnavailable(str(exc)) from exc

    pallets = raw.get("pallets")
    return IntentResponse(
        origin=_match_place(raw.get("origin"), req.known_places),
        destination=_match_place(raw.get("destination"), req.known_places),
        pallets=pallets if isinstance(pallets, int) and 1 <= pallets <= 66 else None,
        with_transit=bool(raw.get("with_transit", False)),
    )
