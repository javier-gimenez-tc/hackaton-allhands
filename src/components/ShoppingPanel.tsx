import { useMemo, useState } from 'react'
import { buildRoute, formatQty, listStats } from '../engine/shopping'
import { getSection } from '../data/sections'
import type { OrderInfo } from '../state/session'
import type { MenuEntry, Recipe, ShoppingItem } from '../types'

interface Props {
  items: ShoppingItem[]
  menu: MenuEntry[]
  recipes: Map<string, Recipe>
  order?: OrderInfo
  onToggle: (key: string) => void
  onAdd: (name: string) => void
  onRemove: (key: string) => void
  onOrder: () => void
}

export function ShoppingPanel({ items, menu, recipes, order, onToggle, onAdd, onRemove, onOrder }: Props) {
  const [draft, setDraft] = useState('')
  const route = useMemo(() => buildRoute(items), [items])
  const stats = useMemo(() => listStats(items, menu, recipes), [items, menu, recipes])

  if (!items.length) {
    return <p className="empty">Genera un menú y aquí aparecerá la lista ordenada por pasillos.</p>
  }

  const copyList = () => {
    const text = route
      .map((stop) =>
        [
          `${stop.section.icon} ${stop.section.name} (${stop.section.aisle})`,
          ...stop.items.map((item) => `  - ${item.name} · ${formatQty(item.qty, item.unit)}`),
        ].join('\n'),
      )
      .join('\n\n')
    navigator.clipboard?.writeText(text)
  }

  return (
    <div>
      <div className="stats">
        <div className="stat">
          <strong>
            {stats.checked}/{stats.items}
          </strong>
          <span>productos</span>
        </div>
        <div className="stat">
          <strong>{stats.sections}</strong>
          <span>paradas</span>
        </div>
        <div className="stat">
          <strong>~{stats.minutes} min</strong>
          <span>en tienda</span>
        </div>
        <div className="stat">
          <strong>~{stats.estimatedCost.toFixed(2)} €</strong>
          <span>coste estimado</span>
        </div>
      </div>

      <div className="split">
        <div>
          {route.map((stop, index) => (
            <section className="card stop" key={stop.section.id}>
              <div className="stop-head">
                <span className="stop-index">{index + 1}</span>
                <div>
                  <h4>
                    {stop.section.icon} {stop.section.name}
                  </h4>
                  <span className="muted small">
                    {stop.section.aisle} · {stop.items.length} productos
                  </span>
                </div>
              </div>

              <div className="items">
                {stop.items.map((item) => (
                  <label className={`item${item.checked ? ' done' : ''}`} key={item.key}>
                    <input type="checkbox" checked={item.checked} onChange={() => onToggle(item.key)} />
                    <span className="item-name">
                      {item.name}
                      <small>{item.usedIn.slice(0, 3).join(' · ')}</small>
                    </span>
                    <span className="item-qty">{formatQty(item.qty, item.unit)}</span>
                    {item.manual && (
                      <button
                        type="button"
                        className="item-remove"
                        aria-label={`Quitar ${item.name}`}
                        onClick={(event) => {
                          event.preventDefault()
                          onRemove(item.key)
                        }}
                      >
                        ×
                      </button>
                    )}
                  </label>
                ))}
              </div>
            </section>
          ))}

          <form
            className="card add-item"
            onSubmit={(event) => {
              event.preventDefault()
              onAdd(draft)
              setDraft('')
            }}
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Añadir producto suelto (se coloca en su pasillo)"
              maxLength={60}
            />
            <button className="btn" type="submit" disabled={!draft.trim()}>
              Añadir
            </button>
          </form>
        </div>

        <aside className="card route-map">
          <h3>Ruta en tienda</h3>
          <p className="muted small">Orden de recorrido para no volver sobre tus pasos.</p>

          <div className="route-line">
            {route.map((stop) => (
              <div className="route-node" key={stop.section.id}>
                <div className="dot">
                  <span>{stop.section.icon}</span>
                </div>
                <div className="body">
                  <strong>{getSection(stop.section.id).name}</strong>
                  <div className="muted small">
                    {stop.section.aisle} · {stop.items.length} prod. · ~{stop.minutes} min
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button className="btn" type="button" style={{ width: '100%', marginTop: 14 }} onClick={onOrder}>
            🚚 Enviar compra online
          </button>
          {order && (
            <p className="muted small" style={{ marginTop: 8 }}>
              Pedido {order.reference} para el {order.deliveryDate} ({order.deliverySlot}).
            </p>
          )}

          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn ghost tiny" type="button" onClick={copyList}>
              📋 Copiar lista
            </button>
            <button className="btn ghost tiny" type="button" onClick={() => window.print()}>
              🖨 Imprimir
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}
