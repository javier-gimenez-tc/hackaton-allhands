# MercaPlan — Resumen de arquitectura y decisiones

## Modelos usados

| Proveedor | Modelo por defecto | Prioridad |
| --- | --- | --- |
| Azure OpenAI | Deployment propio (API `2024-10-21`) | 1ª (si está configurado) |
| OpenAI / compatible | `gpt-4o-mini` (Groq, Together, Ollama…) | 2ª |
| Motor local | Sin LLM: heurísticas + catálogo semilla (`src/engine/fallback.ts`) | Fallback |

**Decisión de modelo**: se usa `gpt-4o-mini` por su **rapidez y coste mínimo**, ideal para prototipar la prueba de concepto con respuestas en segundos. La arquitectura desacopla el modelo del resto del sistema (proveedor detectado por env vars, cliente único en `api/llm.py`), por lo que a futuro se puede incorporar un modelo más eficaz (GPT-5/o*, Claude...) o incluso un **modelo fine-tuned en el ámbito de la nutrición** sin tocar la API ni el frontend.

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
5. **Cero backend persistente (decisión para la demo)**: todo el estado vive en `localStorage` con migración por versión; elegido por simplicidad operativa (sin despliegues de BD, demos offline, cero latencia). A futuro, con persistencia real:
   - **SQL** (p. ej. PostgreSQL) para datos estructurados: clientes, comensales, catálogo de productos, historial de pedidos.
   - **NoSQL** (p. ej. Cosmos DB / MongoDB) para datos de negocio: menús generados, recetas, logs conversacionales del chat y trazas del LLM.
6. **Seguridad básica incluida**: CORS restringido, rate-limit en memoria (30 POST/min/IP), API key solo en `.env`.
7. **Endpoint de chat con acciones**: los ajustes conversacionales devuelven acciones aplicables al estado, no solo texto.
8. **Guardarailes dietéticos y de salud**: las restricciones médicas/alimentarias (celíacos, intolerantes a la lactosa, alergia a frutos secos, veganos, etc.) no se dejan solo al criterio del LLM, se refuerzan en varias capas:
   - **Taxonomía cerrada de dietas** (`sin_gluten`, `sin_lactosa`, `sin_frutos_secos`, `sin_pescado`, `vegano`, `vegetariano`): el modelo solo puede etiquetar con estos tags y Pydantic rechaza cualquier otro — `api/schemas.py:28`.
   - **Validación de coherencia**: un validador de Pydantic elimina el tag vegano si la receta contiene producto animal aunque el modelo lo etiquete mal — `api/schemas.py:94`.
   - **Filtrado tras generación** (`MenuPayload.consolidate`): toda receta del menú debe cumplir el conjunto de dietas de *todos* los comensales; se rescatan alternativas aptas cuando el modelo olvida la receta alternativa (`altRecipeId`) y toda comida garantiza plato para toda la mesa — `api/schemas.py:204`.
   - **Detección en lenguaje natural**: el parser local y los prompts reconocen menciones de "celíaco", "sin gluten", "intolerante a la lactosa", "alergia a los frutos secos"... y las convierten en restricciones del plan — `src/engine/fallback.ts:17`, `api/prompts.py`.
   - **Exclusión explícita de ingredientes**: campo `excluded` del plan para rechazar ingredientes concretos (p. ej. setas), propagado a prompts y chat.
