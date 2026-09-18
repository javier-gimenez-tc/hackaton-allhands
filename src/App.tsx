import { useState } from 'react'
import { CalendarView } from './components/CalendarView'
import { ChatDock } from './components/ChatDock'
import { CookingLoader } from './components/CookingLoader'
import { HistoryView } from './components/HistoryView'
import { LoginScreen } from './components/LoginScreen'
import { MenuBoard } from './components/MenuBoard'
import { OrderModal } from './components/OrderModal'
import { PlanBar } from './components/PlanBar'
import { PromptScreen } from './components/PromptScreen'
import { RecipeModal } from './components/RecipeModal'
import { ReplaceDialog } from './components/ReplaceDialog'
import { ShoppingPanel } from './components/ShoppingPanel'
import { listStats } from './engine/shopping'
import { usePlanner } from './state/usePlanner'
import { TodayView } from './components/TodayView'
import type { MealSlot } from './types'

type Tab = 'hoy' | 'menu' | 'compra' | 'calendario' | 'historial'

const TABS: Array<[Tab, string]> = [
  ['hoy', '☀ Hoy'],
  ['menu', '🍽 Menú'],
  ['compra', '🛒 Lista y ruta'],
  ['calendario', '📅 Calendario'],
  ['historial', '🕘 Historial'],
]

export default function App() {
  const planner = usePlanner()
  const { state, user, history, currentEntry, health, phase, error, recipes, busy, hasPlan } = planner
  const [tab, setTab] = useState<Tab>('hoy')
  const [open, setOpen] = useState<{ recipeId: string; servings: number } | null>(null)
  const [ordering, setOrdering] = useState(false)
  const [replacing, setReplacing] = useState<{ dayIndex: number; slot: MealSlot } | null>(null)

  if (!user) return <LoginScreen onLogin={planner.login} />

  const openRecipe = recipes.get(open?.recipeId ?? '')
  const stats = listStats(state.shopping, state.menu, recipes)
  const generatedLabel = state.generatedAt
    ? new Date(state.generatedAt).toLocaleString('es-ES', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span>🛒</span>
          <span>MercaPlan</span>
        </div>

        <span className="topbar-spacer" />

        {health.ai ? <span className="badge">✨ IA activa</span> : <span className="badge off">motor local</span>}
        {generatedLabel && <span className="badge neutral">guardado {generatedLabel}</span>}

        <button className="user-chip" type="button" onClick={planner.logout} title="Cambiar de usuario">
          <span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span>
          {user.name}
        </button>

        {hasPlan && (
          <button className="btn ghost tiny" type="button" onClick={planner.reset}>
            Nuevo plan
          </button>
        )}
      </header>

      <main className="main">
        {error && (
          <div className="banner">
            <span>⚠️</span>
            <span style={{ flex: 1 }}>{error}</span>
            <button type="button" onClick={planner.dismissError} aria-label="Cerrar aviso">
              ×
            </button>
          </div>
        )}

        {!hasPlan && !busy && (
          <>
            <PromptScreen initialPrompt={state.prompt} busy={busy} onGenerate={planner.generate} />
            {history.length > 0 && (
              <section style={{ marginTop: 26 }}>
                <h2 style={{ fontSize: 17, marginBottom: 10 }}>Tus planes anteriores</h2>
                <HistoryView
                  history={history}
                  currentId={state.historyId}
                  onOpen={(entry) => {
                    planner.openFromHistory(entry)
                    setTab('hoy')
                  }}
                  onDelete={planner.deleteFromHistory}
                />
              </section>
            )}
          </>
        )}

        {busy && !hasPlan && <CookingLoader phase={phase} />}

        {hasPlan && (
          <>
            <PlanBar
              spec={state.spec}
              busy={busy}
              onChange={planner.updateSpec}
              onRegenerate={() => planner.regenerate()}
            />

            <nav className="tabs" role="tablist">
              {TABS.map(([id, label]) => (
                <button key={id} role="tab" type="button" aria-selected={tab === id} onClick={() => setTab(id)}>
                  {label}
                </button>
              ))}
            </nav>

            {busy && <CookingLoader phase={phase} compact />}

            {tab === 'hoy' && (
              <TodayView
                spec={state.spec}
                menu={state.menu}
                recipes={recipes}
                busy={busy}
                onOpenRecipe={(recipeId, servings) => setOpen({ recipeId, servings })}
                onReplace={(dayIndex, slot) => setReplacing({ dayIndex, slot })}
                onGoCalendar={() => setTab('calendario')}
              />
            )}

            {tab === 'menu' && (
              <MenuBoard
                spec={state.spec}
                menu={state.menu}
                recipes={recipes}
                busy={busy}
                onOpenRecipe={(recipeId, servings) => setOpen({ recipeId, servings })}
                onReplace={(dayIndex, slot) => setReplacing({ dayIndex, slot })}
                onToggleLock={planner.toggleLock}
              />
            )}

            {tab === 'compra' && (
              <ShoppingPanel
                items={state.shopping}
                menu={state.menu}
                recipes={recipes}
                order={currentEntry?.order}
                onToggle={planner.toggleItem}
                onAdd={planner.addItem}
                onRemove={planner.removeItem}
                onOrder={() => setOrdering(true)}
              />
            )}

            {tab === 'calendario' && (
              <CalendarView
                spec={state.spec}
                menu={state.menu}
                recipes={recipes}
                onOpenRecipe={(recipeId, servings) => setOpen({ recipeId, servings })}
              />
            )}

            {tab === 'historial' && (
              <HistoryView
                history={history}
                currentId={state.historyId}
                onOpen={(entry) => {
                  planner.openFromHistory(entry)
                  setTab('hoy')
                }}
                onDelete={planner.deleteFromHistory}
              />
            )}
          </>
        )}
      </main>

      {openRecipe && open && (
        <RecipeModal recipe={openRecipe} servings={open.servings} onClose={() => setOpen(null)} />
      )}

      {replacing && (
        <ReplaceDialog
          slot={replacing.slot}
          mealName={
            recipes.get(
              state.menu.find(
                (entry) => entry.dayIndex === replacing.dayIndex && entry.slot === replacing.slot,
              )?.recipeId ?? '',
            )?.name ?? 'esta comida'
          }
          onClose={() => setReplacing(null)}
          onReplace={(hint) => planner.replaceMeal(replacing.dayIndex, replacing.slot, hint)}
        />
      )}

      {ordering && (
        <OrderModal
          items={state.shopping}
          estimatedCost={stats.estimatedCost}
          existingOrder={currentEntry?.order}
          onConfirm={planner.placeOrder}
          onClose={() => setOrdering(false)}
        />
      )}

      <ChatDock
        messages={state.chat}
        busy={phase === 'chatting'}
        aiEnabled={health.ai}
        onSend={planner.sendChat}
      />
    </div>
  )
}
