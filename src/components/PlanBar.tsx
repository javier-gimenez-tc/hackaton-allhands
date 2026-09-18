import type { DietTag, MealSlot, PlanSpec } from '../types'

const DIETS: Array<[DietTag, string]> = [
  ['vegano', 'Vegano'],
  ['vegetariano', 'Vegetariano'],
  ['sin_gluten', 'Sin gluten'],
  ['sin_lactosa', 'Sin lactosa'],
  ['sin_pescado', 'Sin pescado'],
  ['sin_frutos_secos', 'Sin f. secos'],
]

interface Props {
  spec: PlanSpec
  busy: boolean
  onChange: (patch: Partial<PlanSpec>) => void
  onRegenerate: () => void
}

export function PlanBar({ spec, busy, onChange, onRegenerate }: Props) {
  const setPeopleCount = (count: number) => {
    const total = Math.min(12, Math.max(1, count))
    const people = Array.from({ length: total }, (_, i) => spec.people[i] ?? {
      id: `p${i + 1}`,
      name: `Comensal ${i + 1}`,
      diets: [],
    })
    onChange({ people })
  }

  const toggleDiet = (personId: string, diet: DietTag) => {
    onChange({
      people: spec.people.map((person) =>
        person.id === personId
          ? {
              ...person,
              diets: person.diets.includes(diet)
                ? person.diets.filter((d) => d !== diet)
                : [...person.diets, diet],
            }
          : person,
      ),
    })
  }

  const toggleSlot = (slot: MealSlot) => {
    const slots = spec.slots.includes(slot)
      ? spec.slots.filter((s) => s !== slot)
      : ([...spec.slots, slot] as MealSlot[])
    if (slots.length) onChange({ slots })
  }

  return (
    <section className="card planbar">
      <div className="planbar-grid">
        <div className="field">
          <label htmlFor="people">Comensales</label>
          <input
            id="people"
            type="number"
            min={1}
            max={12}
            value={spec.people.length}
            onChange={(e) => setPeopleCount(Number(e.target.value))}
          />
        </div>

        <div className="field">
          <label htmlFor="days">Días</label>
          <input
            id="days"
            type="number"
            min={1}
            max={14}
            value={spec.days}
            onChange={(e) => onChange({ days: Math.min(14, Math.max(1, Number(e.target.value))) })}
          />
        </div>

        <div className="field">
          <label htmlFor="start">Empieza el</label>
          <input
            id="start"
            type="date"
            value={spec.startDate}
            onChange={(e) => onChange({ startDate: e.target.value })}
          />
        </div>

        <div className="field">
          <label htmlFor="minutes">Máx. minutos</label>
          <input
            id="minutes"
            type="number"
            min={10}
            max={180}
            step={5}
            value={spec.maxMinutes}
            onChange={(e) => onChange({ maxMinutes: Number(e.target.value) })}
          />
        </div>

        <div className="field">
          <label htmlFor="budget">€ / persona y día</label>
          <input
            id="budget"
            type="number"
            min={0}
            step={0.5}
            value={spec.budgetPerPersonDay ?? ''}
            placeholder="Sin límite"
            onChange={(e) =>
              onChange({ budgetPerPersonDay: e.target.value ? Number(e.target.value) : undefined })
            }
          />
        </div>

        <div className="field">
          <label>Qué planificar</label>
          <div className="row" style={{ gap: 6 }}>
            {(['comida', 'cena'] as MealSlot[]).map((slot) => (
              <button
                key={slot}
                type="button"
                className="diet-toggle"
                aria-pressed={spec.slots.includes(slot)}
                onClick={() => toggleSlot(slot)}
              >
                {slot === 'comida' ? 'Comidas' : 'Cenas'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="people">
        {spec.people.map((person, index) => (
          <div className="person" key={person.id}>
            <input
              type="text"
              value={person.name}
              aria-label={`Nombre del comensal ${index + 1}`}
              maxLength={40}
              onChange={(e) =>
                onChange({
                  people: spec.people.map((p) =>
                    p.id === person.id ? { ...p, name: e.target.value } : p,
                  ),
                })
              }
            />
            {DIETS.map(([diet, label]) => (
              <button
                key={diet}
                type="button"
                className="diet-toggle"
                aria-pressed={person.diets.includes(diet)}
                onClick={() => toggleDiet(person.id, diet)}
              >
                {label}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row" style={{ gap: 6 }}>
          {spec.notes.slice(0, 3).map((note) => (
            <span className="chip" key={note}>
              {note}
            </span>
          ))}
        </div>
        <button className="btn" type="button" onClick={onRegenerate} disabled={busy}>
          {busy ? 'Generando…' : '✨ Regenerar menú'}
        </button>
      </div>
    </section>
  )
}
