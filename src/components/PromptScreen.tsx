import { useState } from 'react'

const EXAMPLES = [
  'Somos 5 en casa y una persona es vegana. Menú para toda la semana, comidas y cenas, nada que pase de 40 minutos.',
  'Pareja, 5 días, solo cenas ligeras y baratas. Uno es celíaco.',
  'Familia de 4 con dos niños. Menú semanal equilibrado, máximo 6 € por persona y día, sin pescado.',
]

interface Props {
  initialPrompt: string
  busy: boolean
  onGenerate: (prompt: string) => void
}

export function PromptScreen({ initialPrompt, busy, onGenerate }: Props) {
  const [value, setValue] = useState(initialPrompt)

  return (
    <div>
      <div className="hero">
        <h1>Dinos quién come y qué semana tienes</h1>
        <p>
          La IA arma el menú, tú lo retocas, y sale una lista de la compra ordenada por el recorrido
          real de tu Mercadona.
        </p>
      </div>

      <form
        className="card prompt-box"
        onSubmit={(event) => {
          event.preventDefault()
          if (value.trim()) onGenerate(value.trim())
        }}
      >
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Ej.: Somos 5 y una persona es vegana. Menú para toda la semana, comidas y cenas."
          maxLength={2000}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && value.trim()) {
              event.preventDefault()
              onGenerate(value.trim())
            }
          }}
        />

        <div className="examples">
          {EXAMPLES.map((example) => (
            <button key={example} type="button" onClick={() => setValue(example)}>
              {example}
            </button>
          ))}
        </div>

        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="muted small">Ctrl/⌘ + Enter para generar</span>
          <button className="btn" type="submit" disabled={busy || !value.trim()}>
            {busy ? 'Generando…' : 'Generar menú'}
          </button>
        </div>
      </form>
    </div>
  )
}
