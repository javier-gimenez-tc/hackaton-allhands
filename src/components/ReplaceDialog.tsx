import { useEffect, useState } from 'react'

interface Props {
  mealName: string
  slot: string
  onClose: () => void
  onReplace: (hint: string) => void
}

const IDEAS = ['Algo rápido', 'De cuchara', 'Con lo que tengo en casa', 'Más barato', 'Sin horno']

export function ReplaceDialog({ mealName, slot, onClose, onReplace }: Props) {
  const [hint, setHint] = useState('')

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = (value: string) => {
    onReplace(value.trim())
    onClose()
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-wrap" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" type="button" onClick={onClose} aria-label="Cerrar">
          ×
        </button>

        <div className="modal">
          <h2>Cambiar {slot}</h2>
          <p className="muted small">
            Ahora mismo hay <strong>{mealName}</strong>. ¿Quieres poner algo concreto o prefieres que lo
            elijamos nosotros?
          </p>

          <form
            className="field"
            style={{ marginTop: 14 }}
            onSubmit={(event) => {
              event.preventDefault()
              submit(hint)
            }}
          >
            <label htmlFor="hint">Ponlo a mano</label>
            <input
              id="hint"
              value={hint}
              onChange={(event) => setHint(event.target.value)}
              placeholder="Ej.: lentejas con verduras, algo con el pollo que me sobró…"
              maxLength={120}
              autoFocus
            />
          </form>

          <div className="row" style={{ gap: 6, marginTop: 10 }}>
            {IDEAS.map((idea) => (
              <button key={idea} className="chip" type="button" onClick={() => setHint(idea.toLowerCase())}>
                {idea}
              </button>
            ))}
          </div>

          <div className="row" style={{ gap: 8, marginTop: 18 }}>
            <button className="btn" type="button" style={{ flex: 1 }} onClick={() => submit(hint)}>
              {hint.trim() ? 'Usar lo que he escrito' : 'Cambiar'}
            </button>
            <button className="btn subtle" type="button" style={{ flex: 1 }} onClick={() => submit('')}>
              🎲 Sorpréndeme
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
