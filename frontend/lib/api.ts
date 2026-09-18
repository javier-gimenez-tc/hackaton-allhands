import type {
  Cart,
  Constraints,
  GenerateRequest,
  GenerateResponse,
  NutritionSummary,
  OptimizeResult,
  Plan,
  Product,
  Profile,
  Proposal,
  Recipe,
  SelectResponse,
} from "./types";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    let detail = `Error ${res.status}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = String(body.detail);
    } catch {}
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

export async function getProfile(): Promise<Profile> {
  return request<Profile>("/api/profile");
}

export async function searchProducts(q: string): Promise<Product[]> {
  const params = new URLSearchParams({ q });
  return request<Product[]>(`/api/products?${params.toString()}`);
}

export async function generateMenu(
  body: GenerateRequest
): Promise<GenerateResponse> {
  return request<GenerateResponse>("/api/menu/generate", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getPlan(planId: string): Promise<Plan> {
  return request<Plan>(`/api/menu/plans/${planId}`);
}

export async function selectPlan(
  planId: string,
  variant: number
): Promise<SelectResponse> {
  return request<SelectResponse>(`/api/menu/plans/${planId}/select`, {
    method: "POST",
    body: JSON.stringify({ variant }),
  });
}

export async function regenerateMeal(
  planId: string,
  date: string,
  mealType: string,
  feedback: string
): Promise<import("./types").PlannedMeal> {
  return request<import("./types").PlannedMeal>(
    `/api/menu/plans/${planId}/regenerate-meal`,
    {
      method: "POST",
      body: JSON.stringify({ date, meal_type: mealType, feedback }),
    }
  );
}

export async function getRecipe(id: string): Promise<Recipe> {
  return request<Recipe>(`/api/recipes/${id}`);
}

export async function getCart(planId: string): Promise<Cart> {
  return request<Cart>(`/api/cart/${planId}`);
}

export async function optimizeCart(planId: string): Promise<OptimizeResult> {
  return request<OptimizeResult>(`/api/cart/${planId}/optimize`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function getNutritionSummary(
  planId: string
): Promise<NutritionSummary> {
  return request<NutritionSummary>(`/api/nutrition/summary/${planId}`);
}

export type MenuSessionEvent =
  | { node: string }
  | { node: string; latency_ms: number }
  | { attempt: number }
  | { proposals: Proposal[] }
  | { detail: string };

export async function streamMenuEvents(
  sessionId: string,
  handlers: {
    onEvent: (type: string, data: MenuSessionEvent) => void;
    onError?: (err: Error) => void;
    onComplete?: () => void;
  }
): Promise<() => void> {
  const controller = new AbortController();
  const timeoutMs = 90_000;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  (async () => {
    try {
      const res = await fetch(
        `${API_URL}/api/menu/sessions/${sessionId}/events`,
        {
          signal: controller.signal,
          headers: { Accept: "text/event-stream" },
        }
      );
      if (!res.ok || !res.body) throw new ApiError(res.status, `Error ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sepIdx: number;
        while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, sepIdx);
          buffer = buffer.slice(sepIdx + 2);
          let eventType = "message";
          const dataLines: string[] = [];
          for (const line of rawEvent.split("\n")) {
            if (line.startsWith("event:")) eventType = line.slice(6).trim();
            else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
          }
          if (dataLines.length === 0) continue;
          let data: MenuSessionEvent;
          try {
            data = JSON.parse(dataLines.join("\n")) as MenuSessionEvent;
          } catch {
            continue;
          }
          handlers.onEvent(eventType, data);
          if (eventType === "final" || eventType === "error") {
            clearTimeout(timer);
            handlers.onComplete?.();
            return;
          }
        }
      }
      clearTimeout(timer);
      handlers.onComplete?.();
    } catch (err) {
      clearTimeout(timer);
      const error =
        err instanceof Error ? err : new Error("Error de conexión con el servidor");
      if (timedOut) {
        handlers.onError?.(new Error("Tiempo de espera agotado (90 s)"));
      } else if (error.name !== "AbortError") {
        handlers.onError?.(error);
      }
    }
  })();

  return () => controller.abort();
}

export async function sendChat(
  sessionId: string,
  message: string,
  handlers: {
    onToken: (t: string) => void;
    onAction?: (action: string, detail: string) => void;
    onDone?: () => void;
    onError?: (err: Error) => void;
  }
): Promise<() => void> {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ session_id: sessionId, message }),
      });
      if (!res.ok || !res.body) throw new ApiError(res.status, `Error ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sepIdx: number;
        while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, sepIdx);
          buffer = buffer.slice(sepIdx + 2);
          let eventType = "message";
          const dataLines: string[] = [];
          for (const line of rawEvent.split("\n")) {
            if (line.startsWith("event:")) eventType = line.slice(6).trim();
            else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
          }
          if (dataLines.length === 0) continue;
          const dataStr = dataLines.join("\n");
          let data: Record<string, unknown> = {};
          try {
            data = JSON.parse(dataStr);
          } catch {}
          if (eventType === "token") {
            handlers.onToken(typeof data.t === "string" ? data.t : dataStr);
          } else if (eventType === "action_performed") {
            handlers.onAction?.(String(data.action ?? ""), String(data.detail ?? ""));
          } else if (eventType === "done") {
            handlers.onDone?.();
          }
        }
      }
      handlers.onDone?.();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      handlers.onError?.(
        err instanceof Error ? err : new Error("Error de conexión con el servidor")
      );
    }
  })();

  return () => controller.abort();
}
