import { useEffect, useMemo, useState } from 'react'
import { buildRoute } from '../engine/shopping'
import { addDays, formatDate, todayISO } from '../state/store'
import type { OrderInfo } from '../state/session'
import type { ShoppingItem } from '../types'

type Stage = 'form' | 'sending' | 'done'

const SLOTS = ['10:00 - 12:00', '12:00 - 14:00', '17:00 - 19:00', '19:00 - 21:00']

const STEPS = [
  'Comprobando disponibilidad en tu tienda…',
  'Reservando los productos frescos…',
  'Asignando repartidor y franja horaria…',
  'Confirmando el pedido…',
]

interface Props {
  items: ShoppingItem[]
  estimatedCost: number
  existingOrder?: OrderInfo
  onConfirm: (order: OrderInfo) => void
  onClose: () => void
}

export function OrderModal({ items, estimatedCost, existingOrder, onConfirm, onClose }: Props) {
  const [stage, setStage] = useState<Stage>(existingOrder ? 'done' : 'form')
  const [step, setStep] = useState(0)
  const [address, setAddress] = useState('')
  const [date, setDate] = useState(addDays(todayISO(), 1))
  const [slot, setSlot] = useState(SLOTS[2])
  const [order, setOrder] = useState<OrderInfo | undefined>(existingOrder)

  // Si ya has marcado todo (plan antiguo), se pide la lista completa.
  const unchecked = useMemo(() => items.filter((item) => !item.checked), [items])
  const pending = unchecked.length ? unchecked : items
  const route = useMemo(() => buildRoute(pending), [pending])
  const deliveryFee = estimatedCost >= 50 ? 0 : 4.9

  useEffect(() => {
    if (stage !== 'sending') return
    const timer = setInterval(() => {
      setStep((current) => {
        if (current >= STEPS.length - 1) {
          clearInterval(timer)
          const confirmed: OrderInfo = {
            reference: `MP-${Date.now().toString().slice(-6)}`,
            placedAt: Date.now(),
            deliveryDate: date,
            deliverySlot: slot,
            address: address.trim() || 'Dirección guardada',
            items: pending.length,
            total: Math.round((estimatedCost + deliveryFee) * 100) / 100,
          }
          setOrder(confirmed)
          onConfirm(confirmed)
          setStage('done')
          return current
        }
        return current + 1
      })
    }, 900)
    return () => clearInterval(timer)
  }, [address, date, deliveryFee, estimatedCost, onConfirm, pending.length, slot, stage])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && stage !== 'sending') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, stage])

  return (
    <div className="overlay" role="dialog" aria-modal="true" onClick={() => stage !== 'sending' && onClose()}>
      <div className="modal-wrap" onClick={(event) => event.stopPropagation()}>
        {stage !== 'sending' && (
          <button className="modal-close" type="button" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        )}

        <div className="modal">
          {stage === 'form' && (
            <>
              <h2>🚚 Enviar la compra a casa</h2>
              <p className="muted small">
                {unchecked.length
                  ? `Mandamos los ${pending.length} productos que aún no has marcado. Los que ya tienes en casa se quedan fuera del pedido.`
                  : `Ya has marcado toda la lista, así que enviamos los ${pending.length} productos completos.`}
              </p>

              <div className="order-summary">
                {route.map((stop) => (
                  <div key={stop.section.id}>
                    <span>
                      {stop.section.icon} {stop.section.name}
                    </span>
                    <strong>{stop.items.length}</strong>
                  </div>
                ))}
              </div>

              <div className="field" style={{ marginTop: 14 }}>
                <label htmlFor="address">Dirección de entrega</label>
                <input
                  id="address"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="Calle, número, piso"
                  maxLength={120}
                />
              </div>

              <div className="planbar-grid" style={{ marginTop: 12 }}>
                <div className="field">
                  <label htmlFor="date">Día de entrega</label>
                  <input
                    id="date"
                    type="date"
                    value={date}
                    min={todayISO()}
                    onChange={(event) => setDate(event.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="slot">Franja horaria</label>
                  <select id="slot" value={slot} onChange={(event) => setSlot(event.target.value)}>
                    {SLOTS.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="order-total">
                <div>
                  <span>Productos</span>
                  <strong>{estimatedCost.toFixed(2)} €</strong>
                </div>
                <div>
                  <span>Envío</span>
                  <strong>{deliveryFee === 0 ? 'Gratis' : `${deliveryFee.toFixed(2)} €`}</strong>
                </div>
                <div className="grand">
                  <span>Total</span>
                  <strong>{(estimatedCost + deliveryFee).toFixed(2)} €</strong>
                </div>
              </div>

              <button
                className="btn"
                type="button"
                style={{ width: '100%', marginTop: 14 }}
                disabled={!pending.length}
                onClick={() => {
                  setStep(0)
                  setStage('sending')
                }}
              >
                Confirmar pedido
              </button>
              {!pending.length && (
                <p className="muted small" style={{ marginTop: 8 }}>
                  Has marcado todos los productos: no queda nada que pedir.
                </p>
              )}
            </>
          )}

          {stage === 'sending' && (
            <div className="order-sending">
              <div className="truck" aria-hidden="true">
                🚚
              </div>
              <h2>Enviando tu compra</h2>
              <ol className="order-steps">
                {STEPS.map((label, index) => (
                  <li key={label} className={index < step ? 'done' : index === step ? 'active' : ''}>
                    {index < step ? '✓' : index === step ? '•' : '○'} {label}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {stage === 'done' && order && (
            <div className="order-done">
              <div className="check" aria-hidden="true">
                ✓
              </div>
              <h2>Pedido confirmado</h2>
              <p className="muted">
                Referencia <strong>{order.reference}</strong>
              </p>

              <div className="order-total" style={{ marginTop: 14 }}>
                <div>
                  <span>Entrega</span>
                  <strong>{formatDate(order.deliveryDate)}</strong>
                </div>
                <div>
                  <span>Franja</span>
                  <strong>{order.deliverySlot}</strong>
                </div>
                <div>
                  <span>Dirección</span>
                  <strong>{order.address}</strong>
                </div>
                <div className="grand">
                  <span>{order.items} productos</span>
                  <strong>{order.total.toFixed(2)} €</strong>
                </div>
              </div>

              <button className="btn" type="button" style={{ width: '100%', marginTop: 16 }} onClick={onClose}>
                Hecho
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
