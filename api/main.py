"""API de MercaPlan: prompt → plan → menú con IA generativa → recetas → lista de la compra."""

from __future__ import annotations

import logging
import os
import time
from collections import defaultdict
from datetime import date

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

from api.llm import PROVIDER, LLMDisabled, LLMError, generate_json
from api.prompts import CHAT_SYSTEM, MENU_SYSTEM, PLAN_SYSTEM, RECIPE_SYSTEM
from api.schemas import (
    ChatPayload,
    ChatRequest,
    MenuPayload,
    MenuRequest,
    PlanRequest,
    PlanSpec,
    Recipe,
    RecipeRequest,
)

load_dotenv()
logging.basicConfig(level=logging.INFO, format="[mercaplan] %(levelname)s %(message)s")
logger = logging.getLogger("mercaplan")

RATE_LIMIT_MAX = 30
RATE_LIMIT_WINDOW = 60.0
_hits: dict[str, list[float]] = defaultdict(list)

app = FastAPI(title="MercaPlan API", version="0.1.0", docs_url="/api/docs", openapi_url="/api/openapi.json")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.middleware("http")
async def rate_limit(request: Request, call_next):
    if request.url.path.startswith("/api/") and request.method == "POST":
        client = request.client.host if request.client else "unknown"
        now = time.monotonic()
        recent = [t for t in _hits[client] if now - t < RATE_LIMIT_WINDOW]
        if len(recent) >= RATE_LIMIT_MAX:
            _hits[client] = recent
            raise HTTPException(status_code=429, detail="Demasiadas peticiones, espera un momento.")
        recent.append(now)
        _hits[client] = recent
    return await call_next(request)


def _require_ai() -> None:
    if not PROVIDER.enabled:
        raise HTTPException(status_code=503, detail="IA no configurada: el front usará el motor local.")


async def _ask(system: str, user: str, *, temperature: float, max_tokens: int = 4000) -> dict:
    try:
        return await generate_json(system=system, user=user, temperature=temperature, max_tokens=max_tokens)
    except LLMDisabled as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except LLMError as exc:
        logger.error("Fallo de generación: %s", exc)
        raise HTTPException(status_code=502, detail="No se pudo generar el contenido. Reintenta.") from exc


def _parse[T](model: type[T], raw: dict, what: str) -> T:
    try:
        return model.model_validate(raw)  # type: ignore[attr-defined]
    except ValidationError as exc:
        logger.error("%s inválido: %s", what, exc.errors()[:3])
        raise HTTPException(status_code=502, detail=f"El modelo devolvió un {what} inválido. Reintenta.") from exc


@app.get("/api/health")
async def health() -> dict:
    return {"ai": PROVIDER.enabled, "provider": PROVIDER.kind, "model": PROVIDER.model, "auth": PROVIDER.auth}


@app.post("/api/plan")
async def create_plan(body: PlanRequest) -> dict:
    """Prompt en lenguaje natural → ficha estructurada del plan."""
    _require_ai()
    today = date.fromisoformat(body.start_date) if body.start_date else date.today()
    weekday = ("lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo")[today.weekday()]
    raw = await _ask(
        PLAN_SYSTEM,
        f'Petición del usuario:\n"""{body.prompt}"""\n\n'
        f"Fecha de referencia (hoy): {today.isoformat()} ({weekday}).",
        temperature=0.2,
        max_tokens=1200,
    )
    spec = _parse(PlanSpec, raw, "plan")
    if not spec.start_date or spec.start_date < today.isoformat():
        spec.start_date = today.isoformat()
    return {"spec": spec.model_dump(by_alias=True), "source": "ai"}


@app.post("/api/menu")
async def create_menu(body: MenuRequest) -> dict:
    """Ficha del plan → menú completo con recetas generadas."""
    _require_ai()
    spec = body.spec
    total = spec.days * len(spec.slots)

    parts = [spec.describe()]
    if body.avoid_recipes:
        parts.append("No repitas estas recetas ya usadas: " + ", ".join(body.avoid_recipes[:60]) + ".")
    if body.hint:
        parts.append(f"Ajuste pedido por el usuario: {body.hint}")
    parts.append(f"Genera exactamente {total} entradas de menú.")

    raw = await _ask(MENU_SYSTEM, "\n".join(parts), temperature=0.8, max_tokens=8000)
    payload = _parse(MenuPayload, raw, "menú").consolidate(spec)

    if not payload.menu:
        raise HTTPException(status_code=502, detail="El menú generado no cuadra con el plan. Reintenta.")

    return {
        "recipes": [r.model_dump(by_alias=True) for r in payload.recipes],
        "menu": [e.model_dump(by_alias=True) for e in payload.menu],
        "spec": spec.model_dump(by_alias=True),
        "source": "ai",
    }


@app.post("/api/recipe")
async def create_recipe(body: RecipeRequest) -> dict:
    """Genera una única receta para sustituir una comida concreta."""
    _require_ai()
    parts = [body.spec.describe(), f"Slot a cubrir: {body.slot}."]
    if body.replaces:
        parts.append(f"Sustituye a: {body.replaces}. Propón algo claramente distinto.")
    if body.hint:
        parts.append(f"Petición concreta: {body.hint}")
    if body.must_be_suitable_for:
        parts.append(f"La receta debe ser apta para: {body.must_be_suitable_for}.")
    if body.avoid_recipes:
        parts.append("Evita parecerte a: " + ", ".join(body.avoid_recipes[:40]) + ".")

    raw = await _ask(RECIPE_SYSTEM, "\n".join(parts), temperature=0.9, max_tokens=1500)
    recipe = _parse(Recipe, raw.get("recipe", raw), "receta")
    return {"recipe": recipe.model_dump(by_alias=True), "source": "ai"}


@app.post("/api/chat")
async def chat(body: ChatRequest) -> dict:
    """Ajustes conversacionales sobre un plan ya generado."""
    _require_ai()
    parts = ["Estado actual del plan:", body.spec.describe()]
    if body.menu_summary:
        parts.append("Menú actual:\n" + "\n".join(f"- {line[:120]}" for line in body.menu_summary[:30]))
    parts.append(f'\nMensaje del usuario: """{body.message}"""')

    raw = await _ask(CHAT_SYSTEM, "\n".join(parts), temperature=0.3, max_tokens=900)
    payload = _parse(ChatPayload, raw, "chat")
    return payload.model_dump(by_alias=True)
