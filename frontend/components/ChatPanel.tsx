"use client";

import { useEffect, useRef, useState } from "react";
import { sendChat } from "@/lib/api";

type Message = { role: "user" | "assistant"; text: string; action?: string };

const SUGGESTIONS = ["estoy harto de pescado", "el viernes cenamos fuera"];

export default function ChatPanel({
  sessionId,
  className = "",
}: {
  sessionId: string;
  className?: string;
}) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "¡Hola! Puedo ajustar tu menú. Pídeme algo como «sin pescado el jueves».",
    },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streaming]);

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || streaming) return;
    setError(null);
    setInput("");
    setMessages((m) => [...m, { role: "user", text: msg }]);
    setStreaming(true);
    let acc = "";

    sendChat(sessionId, msg, {
      onToken: (t) => {
        acc += t;
        setMessages((m) => {
          const copy = [...m];
          const last = copy[copy.length - 1];
          if (last && last.role === "assistant") {
            copy[copy.length - 1] = { ...last, text: acc };
          } else {
            copy.push({ role: "assistant", text: acc });
          }
          return copy;
        });
      },
      onAction: (action, detail) => {
        setMessages((m) => {
          const copy = [...m];
          const last = copy[copy.length - 1];
          if (last && last.role === "assistant") {
            copy[copy.length - 1] = { ...last, action: `${action}: ${detail}` };
          } else {
            copy.push({ role: "assistant", text: acc, action: `${action}: ${detail}` });
          }
          return copy;
        });
      },
      onDone: () => setStreaming(false),
      onError: (err) => {
        setStreaming(false);
        setError(err.message);
      },
    });
  }

  return (
    <div className={`flex h-full flex-col ${className}`}>
      <div className="border-b border-msurface2 px-4 py-3">
        <h3 className="font-semibold text-mtext">Chat IA</h3>
        <p className="text-xs text-mmuted">Pide cambios en tu menú</p>
      </div>
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : ""}>
            <div
              className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-card px-3 py-2 text-sm ${
                m.role === "user"
                  ? "bg-mgreen text-white"
                  : "bg-msurface text-mtext"
              }`}
            >
              {m.text || (streaming && i === messages.length - 1 ? "…" : "")}
            </div>
            {m.action && (
              <p className="mt-1 inline-block rounded-lg bg-myellow/20 px-2 py-1 text-xs text-mtext">
                ⚡ {m.action}
              </p>
            )}
          </div>
        ))}
        {error && (
          <div className="rounded-card border border-merror/30 bg-merror/10 px-3 py-2 text-sm text-merror">
            {error}{" "}
            <button
              onClick={() => setError(null)}
              className="font-semibold underline"
            >
              Reintentar
            </button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-1 px-4 pb-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => send(s)}
            disabled={streaming}
            className="rounded-full border border-msurface2 bg-msurface px-3 py-1 text-xs text-mtext hover:border-mgreen disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>
      <div className="border-t border-msurface2 p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe un mensaje…"
            className="min-h-[44px] flex-1 rounded-lg border border-msurface2 px-3 text-sm focus:border-mgreen focus:outline-none"
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            className="min-h-[44px] rounded-lg bg-mgreen px-4 font-semibold text-white hover:bg-mgreen-dark disabled:opacity-50"
          >
            Enviar
          </button>
        </form>
      </div>
    </div>
  );
}
