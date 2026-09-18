import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ApiUnavailable,
  fetchHealth,
  requestChat,
  requestMenu,
  requestPlan,
  requestRecipe,
  type ChatAction,
  type HealthInfo,
} from '../api/client'
import {
  buildMenuLocal,
  parsePromptLocal,
  pickReplacementLocal,
  requiredTags,
  suitsEveryone,
} from '../engine/fallback'
import { buildShoppingList, createManualItem, sortByRoute } from '../engine/shopping'
import type { AppState, ChatMessage, MealSlot, MenuEntry, PlanSpec, Recipe, Unit } from '../types'
import {
  clearUser,
  loadHistory,
  loadUser,
  removeHistory,
  saveUser,
  seedHistory,
  upsertHistory,
  type HistoryEntry,
  type OrderInfo,
  type User,
} from './session'
import {
  addDays,
  emptyState,
  loadState,
  pruneRecipes,
  recipeMap,
  saveState,
  servingsFor,
  todayISO,
  toMenuEntries,
} from './store'

const uid = () => Math.random().toString(36).slice(2, 10)

const message = (role: ChatMessage['role'], text: string): ChatMessage => ({
  id: uid(),
  role,
  text,
  at: Date.now(),
})

export type Phase = 'idle' | 'planning' | 'cooking' | 'chatting'

export function usePlanner() {
  // Sin usuario no se rehidrata ningún plan: se entra siempre por el login.
  const [state, setState] = useState<AppState>(() => (loadUser() ? loadState() : emptyState()))
  const [user, setUser] = useState<User | null>(() => loadUser())
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    const current = loadUser()
    return current ? loadHistory(current.slug) : []
  })
  const [health, setHealth] = useState<HealthInfo>({ ai: false, provider: 'none', model: null })
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)

  useEffect(() => {
    fetchHealth().then(setHealth)
  }, [])

  useEffect(() => {
    saveState(state)
  }, [state])

  // Las ediciones del plan abierto se reflejan en su entrada del historial.
  useEffect(() => {
    if (!user || !state.historyId || !state.menu.length) return
    const existing = loadHistory(user.slug).find((entry) => entry.id === state.historyId)
    if (!existing) return
    setHistory(
      upsertHistory({
        ...existing,
        prompt: state.prompt,
        spec: state.spec,
        recipes: state.recipes,
        menu: state.menu,
        shopping: state.shopping,
        source: state.source,
      }),
    )
  }, [state.historyId, state.menu, state.prompt, state.recipes, state.shopping, state.source, state.spec, user])

  const login = useCallback((name: string) => {
    if (!name.trim()) return
    const next = saveUser(name)
    setUser(next)
    setHistory(seedHistory(next))
  }, [])

  const logout = useCallback(() => {
    clearUser()
    setUser(null)
    setHistory([])
    setState(emptyState())
  }, [])

  const recipes = useMemo(() => recipeMap(state.recipes), [state.recipes])
  const recipeName = useCallback(
    (id?: string) => (id ? (recipes.get(id)?.name ?? 'Receta') : 'Receta'),
    [recipes],
  )

  const patchState = useCallback((patch: Partial<AppState>) => {
    setState((prev) => ({ ...prev, ...patch }))
  }, [])

  const rebuildShopping = useCallback(
    (menu: MenuEntry[], nextRecipes: Recipe[], previous: AppState['shopping']) =>
      buildShoppingList({ menu, recipes: recipeMap(nextRecipes), previous }),
    [],
  )

  /** Paso 1: prompt → ficha del plan. */
  const analyzePrompt = useCallback(
    async (prompt: string): Promise<PlanSpec> => {
      const startDate = state.spec.startDate || todayISO()
      if (health.ai) {
        try {
          const { spec } = await requestPlan(prompt, startDate)
          return { ...spec, startDate }
        } catch (err) {
          if (!(err instanceof ApiUnavailable)) throw err
        }
      }
      return { ...parsePromptLocal(prompt), startDate }
    },
    [health.ai, state.spec.startDate],
  )

  /** Paso 2: ficha → menú con recetas generadas. */
  const generateMenu = useCallback(
    async (spec: PlanSpec, hint = '', keepPrevious = false) => {
      const previousMenu = keepPrevious ? state.menu : []
      const avoid = keepPrevious ? state.recipes.map((r) => r.name) : []

      if (health.ai) {
        try {
          const result = await requestMenu(spec, avoid, hint)
          const merged = keepPrevious
            ? [...state.recipes.filter((r) => !result.recipes.some((n) => n.id === r.id)), ...result.recipes]
            : result.recipes
          const menu = toMenuEntries(result.menu, spec, merged, previousMenu)
          return { recipes: pruneRecipes(merged, menu), menu, source: 'ai' as const }
        } catch (err) {
          if (!(err instanceof ApiUnavailable)) throw err
        }
      }

      const local = buildMenuLocal(spec)
      const menu = toMenuEntries(local.menu, spec, local.recipes, previousMenu)
      return { recipes: pruneRecipes(local.recipes, menu), menu, source: 'local' as const }
    },
    [health.ai, state.menu, state.recipes],
  )

  const generate = useCallback(
    async (prompt: string) => {
      if (inFlight.current) return
      inFlight.current = true
      setError(null)
      setPhase('planning')

      try {
        const spec = await analyzePrompt(prompt)
        setPhase('cooking')
        const { recipes: nextRecipes, menu, source } = await generateMenu(spec)
        const historyId = `plan-${Date.now().toString(36)}`
        const shopping = buildShoppingList({ menu, recipes: recipeMap(nextRecipes) })

        if (user) {
          setHistory(
            upsertHistory({
              id: historyId,
              userSlug: user.slug,
              createdAt: Date.now(),
              prompt,
              spec,
              recipes: nextRecipes,
              menu,
              shopping,
              source,
            }),
          )
        }

        setState((prev) => ({
          ...prev,
          historyId,
          prompt,
          spec,
          recipes: nextRecipes,
          menu,
          shopping,
          generatedAt: Date.now(),
          source,
          chat: [
            ...prev.chat,
            message(
              'app',
              source === 'ai'
                ? `Listo: ${menu.length} comidas para ${spec.people.length} comensales. Pídeme cambios cuando quieras.`
                : 'Generado con el motor local (IA no disponible). Puedes editarlo igualmente.',
            ),
          ],
        }))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Algo ha fallado generando el plan.')
      } finally {
        setPhase('idle')
        inFlight.current = false
      }
    },
    [analyzePrompt, generateMenu, user],
  )

  /** Regenera respetando lo que el usuario haya bloqueado. */
  const regenerate = useCallback(
    async (hint = '') => {
      if (inFlight.current) return
      inFlight.current = true
      setError(null)
      setPhase('cooking')
      try {
        const { recipes: nextRecipes, menu, source } = await generateMenu(state.spec, hint, true)
        setState((prev) => ({
          ...prev,
          recipes: nextRecipes,
          menu,
          shopping: rebuildShopping(menu, nextRecipes, prev.shopping),
          generatedAt: Date.now(),
          source,
        }))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo regenerar el menú.')
      } finally {
        setPhase('idle')
        inFlight.current = false
      }
    },
    [generateMenu, rebuildShopping, state.spec],
  )

  /** Cambia una comida concreta por otra receta generada al vuelo. */
  const replaceMeal = useCallback(
    async (dayIndex: number, slot: MealSlot, hint = '') => {
      setError(null)
      setPhase('cooking')
      const target = state.menu.find((e) => e.dayIndex === dayIndex && e.slot === slot)
      const mustSuit = requiredTags(state.spec.people)

      try {
        let recipe: Recipe | undefined
        if (health.ai) {
          try {
            const result = await requestRecipe({
              spec: state.spec,
              slot,
              replaces: recipeName(target?.recipeId),
              hint,
              mustBeSuitableFor: mustSuit.join(', '),
              avoidRecipes: state.recipes.map((r) => r.name),
            })
            recipe = result.recipe
          } catch (err) {
            if (!(err instanceof ApiUnavailable)) throw err
          }
        }
        recipe ??= pickReplacementLocal(state.spec, slot, state.recipes.map((r) => r.id))
        if (!recipe) throw new Error('No hay recetas disponibles para sustituir.')

        const chosen = recipe
        setState((prev) => {
          const nextRecipes = prev.recipes.some((r) => r.id === chosen.id)
            ? prev.recipes
            : [...prev.recipes, chosen]
          const needsAlt = !suitsEveryone(chosen, prev.spec.people)
          const { main, alt } = servingsFor(prev.spec, chosen, needsAlt)

          const menu = prev.menu.map((entry) =>
            entry.dayIndex === dayIndex && entry.slot === slot
              ? { ...entry, recipeId: chosen.id, servings: main, altServings: needsAlt ? alt : 0 }
              : entry,
          )
          const pruned = pruneRecipes(nextRecipes, menu)
          return {
            ...prev,
            recipes: pruned,
            menu,
            shopping: rebuildShopping(menu, pruned, prev.shopping),
          }
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo cambiar la receta.')
      } finally {
        setPhase('idle')
      }
    },
    [health.ai, rebuildShopping, recipeName, state.menu, state.recipes, state.spec],
  )

  const updateSpec = useCallback((patch: Partial<PlanSpec>) => {
    setState((prev) => {
      const spec = { ...prev.spec, ...patch }
      const menu = prev.menu
        .filter((entry) => entry.dayIndex < spec.days && spec.slots.includes(entry.slot))
        .map((entry) => {
          const recipe = prev.recipes.find((r) => r.id === entry.recipeId)
          const { main, alt } = servingsFor(spec, recipe, Boolean(entry.altRecipeId))
          return { ...entry, date: addDays(spec.startDate, entry.dayIndex), servings: main, altServings: alt }
        })
      return {
        ...prev,
        spec,
        menu,
        shopping: buildShoppingList({ menu, recipes: recipeMap(prev.recipes), previous: prev.shopping }),
      }
    })
  }, [])

  const toggleLock = useCallback((entryId: string) => {
    setState((prev) => ({
      ...prev,
      menu: prev.menu.map((e) => (e.id === entryId ? { ...e, locked: !e.locked } : e)),
    }))
  }, [])

  const toggleItem = useCallback((key: string) => {
    setState((prev) => ({
      ...prev,
      shopping: prev.shopping.map((i) => (i.key === key ? { ...i, checked: !i.checked } : i)),
    }))
  }, [])

  const addItem = useCallback((name: string, qty = 1, unit: Unit = 'ud') => {
    if (!name.trim()) return
    setState((prev) => {
      const item = createManualItem(name, qty, unit)
      if (prev.shopping.some((i) => i.key === item.key)) return prev
      return { ...prev, shopping: sortByRoute([...prev.shopping, item]) }
    })
  }, [])

  const removeItem = useCallback((key: string) => {
    setState((prev) => ({ ...prev, shopping: prev.shopping.filter((i) => i.key !== key) }))
  }, [])

  const applyChatActions = useCallback(
    async (actions: ChatAction[]) => {
      for (const action of actions) {
        if (action.type === 'update_spec') updateSpec(action.patch)
        if (action.type === 'add_item') addItem(action.name, action.qty, action.unit)
        if (action.type === 'replace_meal') await replaceMeal(action.dayIndex, action.slot, action.reason)
        if (action.type === 'regenerate_all') await regenerate(action.reason ?? '')
      }
    },
    [addItem, regenerate, replaceMeal, updateSpec],
  )

  const sendChat = useCallback(
    async (text: string) => {
      if (!text.trim()) return
      setState((prev) => ({ ...prev, chat: [...prev.chat, message('user', text)] }))
      setPhase('chatting')

      try {
        if (!health.ai) {
          setState((prev) => ({
            ...prev,
            chat: [...prev.chat, message('app', 'La IA no está disponible. Usa los botones del menú para editar.')],
          }))
          return
        }
        const summary = state.menu.map(
          (e) => `Día ${e.dayIndex + 1} ${e.slot}: ${recipeName(e.recipeId)}`,
        )
        const result = await requestChat(text, state.spec, summary)
        setState((prev) => ({ ...prev, chat: [...prev.chat, message('app', result.reply)] }))
        await applyChatActions(result.actions)
      } catch (err) {
        const detail = err instanceof Error ? err.message : 'No he podido procesar el mensaje.'
        setState((prev) => ({ ...prev, chat: [...prev.chat, message('app', detail)] }))
      } finally {
        setPhase('idle')
      }
    },
    [applyChatActions, health.ai, recipeName, state.menu, state.spec],
  )

  const reset = useCallback(() => {
    setState((prev) => ({ ...emptyState(), chat: prev.chat.slice(-4) }))
  }, [])

  const openFromHistory = useCallback((entry: HistoryEntry) => {
    setState((prev) => ({
      ...prev,
      historyId: entry.id,
      prompt: entry.prompt,
      spec: entry.spec,
      recipes: entry.recipes,
      menu: entry.menu,
      shopping: entry.shopping,
      generatedAt: entry.createdAt,
      source: entry.source,
    }))
  }, [])

  const deleteFromHistory = useCallback(
    (id: string) => {
      if (!user) return
      setHistory(removeHistory(id, user.slug))
      setState((prev) => (prev.historyId === id ? { ...prev, historyId: null } : prev))
    },
    [user],
  )

  const currentEntry = history.find((entry) => entry.id === state.historyId)

  const placeOrder = useCallback(
    (order: OrderInfo) => {
      if (!user || !state.historyId) return
      const entry = loadHistory(user.slug).find((e) => e.id === state.historyId)
      if (!entry) return
      setHistory(upsertHistory({ ...entry, order }))
    },
    [state.historyId, user],
  )

  return {
    state,
    user,
    history,
    currentEntry,
    health,
    phase,
    error,
    recipes,
    recipeName,
    busy: phase !== 'idle',
    hasPlan: state.menu.length > 0,
    login,
    logout,
    generate,
    regenerate,
    replaceMeal,
    updateSpec,
    toggleLock,
    toggleItem,
    addItem,
    removeItem,
    sendChat,
    reset,
    openFromHistory,
    deleteFromHistory,
    placeOrder,
    patchState,
    dismissError: () => setError(null),
  }
}
