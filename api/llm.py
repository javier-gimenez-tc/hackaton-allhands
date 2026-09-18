"""Cliente del LLM. La clave vive solo aquí, nunca llega al navegador."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from dataclasses import dataclass
from typing import Any

import httpx
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("mercaplan.llm")


class LLMError(RuntimeError):
    """Fallo al hablar con el modelo o respuesta inutilizable."""


class LLMDisabled(LLMError):
    """No hay credenciales configuradas."""


@dataclass(frozen=True)
class Provider:
    kind: str
    model: str | None
    auth: str = "key"

    @property
    def enabled(self) -> bool:
        return self.kind != "none"


def _env(name: str, default: str = "") -> str:
    return (os.getenv(name) or default).strip()


def _detect_provider() -> Provider:
    if _env("AZURE_OPENAI_ENDPOINT") and _env("AZURE_OPENAI_DEPLOYMENT"):
        # Sin clave usamos la identidad de Entra ID (az login / managed identity).
        auth = "key" if _env("AZURE_OPENAI_API_KEY") else "entra"
        return Provider("azure", _env("AZURE_OPENAI_DEPLOYMENT"), auth)
    if _env("OPENAI_API_KEY"):
        return Provider("openai", _env("OPENAI_MODEL", "gpt-4o-mini"), "key")
    return Provider("none", None, "none")


PROVIDER = _detect_provider()

COGNITIVE_SCOPE = "https://cognitiveservices.azure.com/.default"
_credential: Any = None
_cached_token: tuple[str, float] | None = None


async def _entra_headers() -> dict[str, str]:
    """Token de Entra ID (az login o managed identity), cacheado hasta un minuto antes de expirar."""
    global _credential, _cached_token

    if _cached_token and _cached_token[1] - 60 > time.time():
        return {"Authorization": f"Bearer {_cached_token[0]}"}

    try:
        from azure.identity import DefaultAzureCredential
    except ImportError as exc:
        raise LLMError("Falta azure-identity: ejecuta `uv sync`.") from exc

    if _credential is None:
        _credential = DefaultAzureCredential()
    try:
        token = await asyncio.to_thread(_credential.get_token, COGNITIVE_SCOPE)
    except Exception as exc:
        raise LLMError(
            "No se pudo obtener token de Entra ID. Haz `az login` o define AZURE_OPENAI_API_KEY."
        ) from exc

    _cached_token = (token.token, float(token.expires_on))
    return {"Authorization": f"Bearer {token.token}"}


async def _request_parts() -> tuple[str, dict[str, str], dict[str, Any]]:
    if PROVIDER.kind == "azure":
        endpoint = _env("AZURE_OPENAI_ENDPOINT").rstrip("/")
        version = _env("AZURE_OPENAI_API_VERSION", "2024-10-21")
        url = f"{endpoint}/openai/deployments/{PROVIDER.model}/chat/completions?api-version={version}"
        headers = (
            {"api-key": _env("AZURE_OPENAI_API_KEY")}
            if PROVIDER.auth == "key"
            else await _entra_headers()
        )
        return url, headers, {}

    base = _env("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    return (
        f"{base}/chat/completions",
        {"Authorization": f"Bearer {_env('OPENAI_API_KEY')}"},
        {"model": PROVIDER.model},
    )


_REASONING_FAMILIES = ("gpt-5", "o1", "o3", "o4")


def _is_reasoning_model() -> bool:
    """La familia GPT-5/o* rechaza max_tokens y temperature personalizada."""
    name = (PROVIDER.model or "").lower()
    return any(name.startswith(f) or f"-{f}" in name for f in _REASONING_FAMILIES)


def _tuning(temperature: float, max_tokens: int) -> dict[str, Any]:
    if _is_reasoning_model():
        return {"max_completion_tokens": max_tokens}
    return {"temperature": temperature, "max_tokens": max_tokens}


async def generate_json(
    *,
    system: str,
    user: str,
    temperature: float = 0.7,
    max_tokens: int = 4000,
) -> dict[str, Any]:
    """Pide al modelo un JSON estricto y lo devuelve parseado."""
    if not PROVIDER.enabled:
        raise LLMDisabled("Sin credenciales de IA configuradas")

    url, auth_headers, extra_body = await _request_parts()
    payload = {
        **extra_body,
        **_tuning(temperature, max_tokens),
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=10.0)) as client:
            response = await client.post(
                url,
                headers={"Content-Type": "application/json", **auth_headers},
                json=payload,
            )
    except httpx.HTTPError as exc:
        raise LLMError(f"Error de red hablando con el modelo: {exc}") from exc

    if response.status_code >= 400:
        logger.error("LLM %s: %s", response.status_code, response.text[:400])
        raise LLMError(f"El proveedor devolvió {response.status_code}")

    try:
        content = response.json()["choices"][0]["message"]["content"]
    except (KeyError, IndexError, ValueError) as exc:
        raise LLMError("Respuesta del modelo con formato inesperado") from exc

    try:
        data = json.loads(content)
    except json.JSONDecodeError as exc:
        raise LLMError("El modelo no devolvió JSON válido") from exc

    if not isinstance(data, dict):
        raise LLMError("El modelo devolvió un JSON que no es un objeto")
    return data
