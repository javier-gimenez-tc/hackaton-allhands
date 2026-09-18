# MercaPlan — Resumen de arquitectura y decisiones

## Modelos usados

| Proveedor | Modelo por defecto | Prioridad |
| --- | --- | --- |
| Azure OpenAI | Deployment propio (API `2024-10-21`) | 1ª (si está configurado) |
| OpenAI / compatible | `gpt-4o-mini` (Groq, Together, Ollama…) | 2ª |
| Motor local | Sin LLM: heurísticas + catálogo semilla (`src/engine/fallback.ts`) | Fallback |

- Soporta modelos de razonamiento (GPT-5, o1/o3/o4) ajustando parámetros (`max_completion_tokens`, sin temperature) — `api/llm.py:105`.
- Autenticación Azure por API key o **Entra ID** (`DefaultAzureCredential`, token cacheado) — `api/llm.py:60`.

## Arquitectura

**Split full-stack sin base de datos:**

```
Frontend (React 19 + Vite + TS, :5173)
   │  fetch JSON
   ▼
API FastAPI (Python 3.11, :8000)  ──►  LLM (JSON estricto, response_format)
   schemas Pydantic validan la salida del modelo
   ▼
Cálculo de compra y ruta en el cliente (src/engine/shopping.ts)
```

| Pieza | Tecnología | Rol |
| --- | --- | --- |
| API | FastAPI + httpx + Pydantic v2 | 4 endpoints: `/plan`, `/menu`, `/recipe`, `/chat` |
| Prompts | `api/prompts.py` | Reglas culinarias + formatos JSON exactos (secciones, unidades, tags cerrados) |
| Estado | React puro (sin Redux/Zustand), `localStorage` versionado (v4) | Caché y orquestación — `src/state/` |
| Dominio | TypeScript | Agregación, redondeo comercial, orden de pasillos Mercadona (`src/data/sections.ts`) |

## Decisiones clave

1. **La clave del LLM nunca sale del servidor** — el navegador solo habla con la API propia.
2. **JSON estricto con validación de salida**: los prompts fuerzan un único objeto JSON y Pydantic rechaza respuestas inválidas (502 con reintento).
3. **Degradación elegante**: sin credenciales la app funciona igual con el motor local → demos sin red.
4. **Dominio en el cliente, IA solo para generación**: la lista de la compra y la ruta se calculan en TypeScript, deterministas y offline (agregación por `nombre|unidad`, redondeo a formato de compra real, 14 secciones en orden de recorrido de tienda).
5. **Cero backend persistente**: todo el estado vive en `localStorage` con migración por versión; no hay BD ni sesión de servidor.
6. **Seguridad básica incluida**: CORS restringido, rate-limit en memoria (30 POST/min/IP), API key solo en `.env`.
7. **Endpoint de chat con acciones**: los ajustes conversacionales devuelven acciones aplicables al estado, no solo texto.
