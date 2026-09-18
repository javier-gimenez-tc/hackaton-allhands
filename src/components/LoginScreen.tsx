import { useState } from 'react'

interface Props {
  onLogin: (name: string) => void
}

export function LoginScreen({ onLogin }: Props) {
  const [name, setName] = useState('')

  return (
    <div className="login">
      <div className="login-art" aria-hidden="true">
        <span>🛒</span>
        <span>🥕</span>
        <span>🍅</span>
        <span>🥖</span>
      </div>

      <h1>Hola, ¿quién cocina esta semana?</h1>
      <p className="muted">
        Solo tu nombre. Guardamos tus planes en este dispositivo para que encuentres el historial al
        volver.
      </p>

      <form
        className="card login-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (name.trim()) onLogin(name.trim())
        }}
      >
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Tu nombre"
          maxLength={40}
          autoFocus
          aria-label="Tu nombre"
        />
        <button className="btn" type="submit" disabled={!name.trim()}>
          Entrar
        </button>
      </form>
    </div>
  )
}
