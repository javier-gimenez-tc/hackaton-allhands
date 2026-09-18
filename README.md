# MercaPlan

De un prompt a la lista de la compra ordenada por el pasillo de Mercadona.

**Flujo:** prompt en lenguaje natural → ficha del plan (comensales, dietas, días) → menú y recetas
generadas con IA → lista de la compra agrupada por sección → ruta optimizada en tienda → calendario
de recetas. Todo cacheado en el navegador y editable desde el chat de la esquina.

## Arranque

```bash
cp .env.example .env     # pon tu OPENAI_API_KEY (o las de Azure OpenAI)
uv sync                  # backend Python
yarn install             # frontend
yarn start               # API (8000) + web (5173) a la vez
```

Sin credenciales la app sigue funcionando con el **motor local** de respaldo: parsea el prompt con
heurísticas y monta el menú desde el catálogo semilla. Útil para demos sin red.

## Arquitectura

| Capa | Qué hace | Dónde |
| --- | --- | --- |
| API FastAPI | Habla con el LLM, valida su salida con Pydantic | `api/` |
| Prompts | El saber culinario que guía al modelo | `api/prompts.py` |
| Motor local | Fallback sin IA | `src/engine/fallback.ts` |
| Compra y ruta | Agregación, redondeo a formato de compra, orden de pasillos | `src/engine/shopping.ts` |
| Estado | Caché en localStorage y orquestación | `src/state/` |

La clave del modelo vive **solo en el servidor**; el navegador nunca la ve.

## Endpoints

- `GET /api/health` — si hay IA configurada y con qué modelo
- `POST /api/plan` — prompt → ficha estructurada
- `POST /api/menu` — ficha → menú completo con recetas
- `POST /api/recipe` — una receta suelta para sustituir una comida
- `POST /api/chat` — ajustes conversacionales que devuelven acciones aplicables

Docs interactivas en `http://localhost:8000/api/docs`.
