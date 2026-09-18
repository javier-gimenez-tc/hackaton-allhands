import { useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '../types'

const SUGGESTIONS = [
  'El martes por la noche algo en 15 minutos',
  'Esta semana sin pescado',
  'Hazlo más barato',
  'Añade papel de cocina a la lista',
]

interface Props {
  messages: ChatMessage[]
  busy: boolean
  aiEnabled: boolean
  onSend: (text: string) => void
}

export function ChatDock({ messages, busy, aiEnabled, onSend }: Props) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, open])

  const submit = (text: string) => {
    if (!text.trim() || busy) return
    onSend(text.trim())
    setDraft('')
  }

  if (!open) {
    return (
      <button className="chat-fab" type="button" onClick={() => setOpen(true)} aria-label="Abrir asistente">
        💬
      </button>
    )
  }

  return (
    <div className="chat-panel">
      <div className="chat-head">
        <span>💬 Asistente</span>
        {!aiEnabled && <span className="badge off">sin IA</span>}
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar asistente">
          ×
        </button>
      </div>

      <div className="chat-body" ref={bodyRef}>
        {messages.length === 0 && (
          <div className="bubble app">
            Pídeme cambios en lenguaje natural: cambiar una cena, quitar un ingrediente, ajustar el
            presupuesto o añadir productos a la lista.
          </div>
        )}
        {messages.map((msg) => (
          <div className={`bubble ${msg.role}`} key={msg.id}>
            {msg.text}
          </div>
        ))}
        {busy && <div className="bubble app">Pensando…</div>}
      </div>

      <div className="chat-suggestions">
        {SUGGESTIONS.map((suggestion) => (
          <button key={suggestion} type="button" onClick={() => submit(suggestion)} disabled={busy}>
            {suggestion}
          </button>
        ))}
      </div>

      <form
        className="chat-form"
        onSubmit={(event) => {
          event.preventDefault()
          submit(draft)
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Escribe un ajuste…"
          maxLength={800}
        />
        <button className="btn" type="submit" disabled={busy || !draft.trim()}>
          ➤
        </button>
      </form>
    </div>
  )
}
