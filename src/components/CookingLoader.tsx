import { useEffect, useState } from 'react'

const PHASE_TITLES: Record<string, string> = {
  planning: 'Entendiendo a tus comensales',
  cooking: 'Inventando recetas para tu semana',
  chatting: 'Aplicando tus cambios',
}

const TIPS = [
  'Las legumbres en conserva ahorran 40 minutos de cocción y cuestan casi lo mismo.',
  'La fruta y verdura de temporada es hasta un 30 % más barata y sabe mejor.',
  'Congelar el pan en rebanadas evita tirar media barra cada semana.',
  'Cocinar de más a propósito es la forma más rápida de tener la cena del día siguiente.',
  'El 17 % de la comida que se compra en España acaba en la basura. Planificar lo reduce a la mitad.',
  'Comprar con lista cerrada baja el ticket medio alrededor de un 20 %.',
  'Los congelados de verdura conservan las vitaminas igual que los frescos.',
  'Empezar por frutería y acabar por congelados evita romper la cadena de frío.',
]

const SCENE = ['🥕', '🍅', '🧅', '🫑', '🥦', '🍆', '🌽', '🧄']

interface Props {
  phase: string
  compact?: boolean
}

export function CookingLoader({ phase, compact = false }: Props) {
  const [tip, setTip] = useState(() => Math.floor(Math.random() * TIPS.length))
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    const tipTimer = setInterval(() => setTip((current) => (current + 1) % TIPS.length), 5200)
    const clock = setInterval(() => setSeconds((current) => current + 1), 1000)
    return () => {
      clearInterval(tipTimer)
      clearInterval(clock)
    }
  }, [])

  if (compact) {
    return (
      <div className="loader-compact">
        <div className="spinner" />
        <span className="muted small">
          {PHASE_TITLES[phase] ?? 'Trabajando'}… {seconds}s
        </span>
      </div>
    )
  }

  return (
    <div className="loader">
      <div className="kitchen" aria-hidden="true">
        <div className="orbit">
          {SCENE.map((emoji, index) => (
            <span key={emoji} style={{ ['--i' as string]: index }}>
              {emoji}
            </span>
          ))}
        </div>
        <div className="pot">
          <span className="steam s1">·</span>
          <span className="steam s2">·</span>
          <span className="steam s3">·</span>
          🍲
        </div>
      </div>

      <h2>{PHASE_TITLES[phase] ?? 'Trabajando'}…</h2>
      <div className="loader-bar">
        <span />
      </div>
      <p className="muted small">{seconds}s · esto tarda menos que hervir la pasta</p>

      <div className="card tip" key={tip}>
        <strong>¿Sabías que…?</strong>
        <p>{TIPS[tip]}</p>
      </div>
    </div>
  )
}
