import { useEffect } from 'react'
import { getSection } from '../data/sections'
import { formatQty } from '../engine/shopping'
import type { Recipe } from '../types'

interface Props {
  recipe: Recipe
  servings: number
  onClose: () => void
}

export function RecipeModal({ recipe, servings, onClose }: Props) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-wrap" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" type="button" onClick={onClose} aria-label="Cerrar">
          ×
        </button>

        <div className="modal">
          <h2>{recipe.name}</h2>

          <div className="row" style={{ marginTop: 10 }}>
            <span className="chip">⏱ {recipe.minutes} min</span>
            <span className="chip">🔥 {recipe.kcal} kcal</span>
            <span className="chip">💶 {(recipe.costPerServing * servings).toFixed(2)} €</span>
            <span className="chip">🍽 {servings} raciones</span>
            {recipe.tags.map((tag) => (
              <span className="chip diet" key={tag}>
                {tag.replace(/_/g, ' ')}
              </span>
            ))}
          </div>

          <h3 style={{ marginTop: 18, fontSize: 15 }}>Ingredientes</h3>
          <ul className="ingredient-list">
            {recipe.ingredients.map((ingredient) => (
              <li key={`${ingredient.name}-${ingredient.unit}`}>
                <span>
                  {ingredient.name}
                  <span className="muted small"> · {getSection(ingredient.section).name}</span>
                </span>
                <strong>{formatQty(ingredient.qty * servings, ingredient.unit)}</strong>
              </li>
            ))}
          </ul>

          <h3 style={{ marginTop: 18, fontSize: 15 }}>Preparación</h3>
          <ol className="steps">
            {recipe.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  )
}
