"""Modelos de dominio. Pydantic hace de cortafuegos entre la creatividad del LLM y el front."""

from __future__ import annotations

import re
import unicodedata
from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

SectionId = Literal[
    "frutas_verduras",
    "panaderia",
    "carniceria",
    "pescaderia",
    "charcuteria",
    "huevos_lacteos",
    "refrigerados_veg",
    "congelados",
    "despensa",
    "conservas",
    "aceite_especias",
    "desayuno_dulce",
    "bebidas",
    "drogueria",
]

DietTag = Literal[
    "vegano",
    "vegetariano",
    "sin_gluten",
    "sin_lactosa",
    "sin_pescado",
    "sin_frutos_secos",
]

MealSlot = Literal["comida", "cena"]
Unit = Literal["g", "ml", "ud", "cda", "pizca"]

SECTION_IDS: tuple[str, ...] = SectionId.__args__  # type: ignore[attr-defined]
DIET_TAGS: tuple[str, ...] = DietTag.__args__  # type: ignore[attr-defined]
UNITS: tuple[str, ...] = Unit.__args__  # type: ignore[attr-defined]
MEAL_SLOTS: tuple[str, ...] = MealSlot.__args__  # type: ignore[attr-defined]


def slugify(value: str, fallback: str = "receta") -> str:
    normalized = unicodedata.normalize("NFD", str(value))
    ascii_only = "".join(c for c in normalized if unicodedata.category(c) != "Mn")
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_only.lower()).strip("-")[:60]
    return slug or fallback


class Base(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)


class Ingredient(Base):
    name: Annotated[str, Field(min_length=1, max_length=60)]
    qty: Annotated[float, Field(gt=0, le=2000)]
    unit: Unit = "g"
    section: SectionId = "despensa"

    @field_validator("name")
    @classmethod
    def _clean_name(cls, v: str) -> str:
        return v.strip()[:60]


class Recipe(Base):
    """Cantidades expresadas POR RACIÓN; el front escala según comensales."""

    id: Annotated[str, Field(max_length=60)] = ""
    name: Annotated[str, Field(min_length=1, max_length=90)]
    minutes: Annotated[int, Field(ge=5, le=180)] = 30
    kcal: Annotated[int, Field(ge=120, le=1500)] = 500
    cost_per_serving: Annotated[float, Field(ge=0.2, le=25, alias="costPerServing")] = 2.0
    tags: list[DietTag] = Field(default_factory=list)
    slots: list[MealSlot] = Field(default_factory=lambda: ["comida", "cena"])
    ingredients: Annotated[list[Ingredient], Field(min_length=1, max_length=14)]
    steps: Annotated[list[str], Field(min_length=1, max_length=10)]

    @field_validator("steps", mode="before")
    @classmethod
    def _clean_steps(cls, v: object) -> list[str]:
        if not isinstance(v, list):
            return []
        return [str(s).strip()[:320] for s in v if str(s).strip()][:10]

    @field_validator("tags", "slots")
    @classmethod
    def _dedupe(cls, v: list[str]) -> list[str]:
        return list(dict.fromkeys(v))

    @model_validator(mode="after")
    def _fill_defaults(self) -> Recipe:
        if not self.id:
            self.id = slugify(self.name)
        else:
            self.id = slugify(self.id, slugify(self.name))
        if not self.slots:
            self.slots = ["comida", "cena"]
        # Coherencia: nada vegano puede llevar producto animal aunque el modelo lo etiquete así.
        if "vegano" in self.tags and self._has_animal_product():
            self.tags = [t for t in self.tags if t not in ("vegano", "vegetariano")]
        if "vegano" in self.tags and "vegetariano" not in self.tags:
            self.tags.append("vegetariano")
        return self

    def _has_animal_product(self) -> bool:
        blocked = (
            "pollo", "ternera", "cerdo", "pavo", "jamón", "jamon", "bacon", "chorizo",
            "carne", "merluza", "salmón", "salmon", "atún", "atun", "gamba", "pescado",
            "bacalao", "huevo", "leche entera", "queso", "nata", "mantequilla", "yogur natural",
            "miel", "anchoa", "marisco",
        )
        return any(b in ing.name.lower() for ing in self.ingredients for b in blocked)


class Person(Base):
    id: Annotated[str, Field(max_length=40)] = ""
    name: Annotated[str, Field(max_length=40)] = ""
    diets: list[DietTag] = Field(default_factory=list)

    @field_validator("diets")
    @classmethod
    def _dedupe(cls, v: list[str]) -> list[str]:
        return list(dict.fromkeys(v))


class PlanSpec(Base):
    people: Annotated[list[Person], Field(max_length=12)] = Field(default_factory=list)
    days: Annotated[int, Field(ge=1, le=14)] = 7
    start_date: Annotated[str | None, Field(max_length=10, alias="startDate")] = None
    slots: list[MealSlot] = Field(default_factory=lambda: ["comida", "cena"])
    max_minutes: Annotated[int, Field(ge=10, le=180), Field(alias="maxMinutes")] = 45
    budget_per_person_day: Annotated[float | None, Field(ge=0, le=100, alias="budgetPerPersonDay")] = None
    excluded: Annotated[list[str], Field(max_length=20)] = Field(default_factory=list)
    notes: Annotated[list[str], Field(max_length=8)] = Field(default_factory=list)

    @field_validator("excluded", mode="before")
    @classmethod
    def _clean_excluded(cls, v: object) -> list[str]:
        if not isinstance(v, list):
            return []
        cleaned = [str(x).strip().lower()[:40] for x in v if str(x).strip()]
        return list(dict.fromkeys(cleaned))[:20]

    @field_validator("notes", mode="before")
    @classmethod
    def _clean_notes(cls, v: object) -> list[str]:
        if not isinstance(v, list):
            return []
        return [str(x).strip()[:160] for x in v if str(x).strip()][:8]

    @field_validator("start_date", mode="before")
    @classmethod
    def _clean_start_date(cls, v: object) -> str | None:
        text = str(v or "").strip()[:10]
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", text):
            return None
        try:
            date.fromisoformat(text)
        except ValueError:
            return None
        return text

    @model_validator(mode="after")
    def _fill_defaults(self) -> PlanSpec:
        if not self.people:
            self.people = [Person(id="p1", name="Comensal 1", diets=[])]
        for i, person in enumerate(self.people, start=1):
            person.id = slugify(person.id, f"p{i}") if person.id else f"p{i}"
            person.name = person.name.strip() or f"Comensal {i}"
        if not self.slots:
            self.slots = ["comida", "cena"]
        self.slots = list(dict.fromkeys(self.slots))
        return self

    def describe(self) -> str:
        people = "; ".join(
            f"{p.name} ({', '.join(p.diets) if p.diets else 'sin restricciones'})" for p in self.people
        )
        budget = (
            f"{self.budget_per_person_day} € por persona y día"
            if self.budget_per_person_day
            else "sin límite"
        )
        lines = [
            f"Comensales ({len(self.people)}): {people}",
            f"Días: {self.days}",
            f"Primer día del plan: {self.start_date or 'hoy'}",
            f"Comidas a planificar: {' y '.join(self.slots)}",
            f"Tiempo máximo por receta: {self.max_minutes} minutos",
            f"Presupuesto: {budget}",
            f"Ingredientes prohibidos: {', '.join(self.excluded) if self.excluded else 'ninguno'}",
        ]
        if self.notes:
            lines.append("Notas: " + " | ".join(self.notes))
        return "\n".join(lines)


class MenuEntry(Base):
    day_index: Annotated[int, Field(ge=0, le=13, alias="dayIndex")]
    slot: MealSlot
    recipe_id: Annotated[str, Field(min_length=1, max_length=60, alias="recipeId")]
    alt_recipe_id: Annotated[str | None, Field(max_length=60, alias="altRecipeId")] = None

    @field_validator("recipe_id", "alt_recipe_id")
    @classmethod
    def _slug(cls, v: str | None) -> str | None:
        return slugify(v, "") if v else None


class MenuPayload(Base):
    recipes: Annotated[list[Recipe], Field(min_length=1, max_length=40)]
    menu: Annotated[list[MenuEntry], Field(min_length=1, max_length=40)]

    def consolidate(self, spec: PlanSpec) -> MenuPayload:
        """Descarta entradas incoherentes y garantiza alternativa para toda dieta restringida."""
        by_id = {r.id: r for r in self.recipes}
        required = {diet for person in spec.people for diet in person.diets}
        seen: set[tuple[int, str]] = set()
        entries: list[MenuEntry] = []

        def suitable(recipe: Recipe) -> bool:
            return required.issubset(set(recipe.tags))

        for entry in self.menu:
            if entry.recipe_id not in by_id or entry.slot not in spec.slots:
                continue
            if entry.day_index >= spec.days:
                continue
            key = (entry.day_index, entry.slot)
            if key in seen:
                continue

            alt = by_id.get(entry.alt_recipe_id or "")
            if alt is None or entry.alt_recipe_id == entry.recipe_id or not suitable(alt):
                entry.alt_recipe_id = None

            # El modelo a veces olvida la alternativa: la rescatamos del propio menú.
            if required and not suitable(by_id[entry.recipe_id]) and entry.alt_recipe_id is None:
                rescue = next(
                    (
                        r
                        for r in sorted(self.recipes, key=lambda x: entry.slot not in x.slots)
                        if r.id != entry.recipe_id and suitable(r)
                    ),
                    None,
                )
                if rescue is not None:
                    entry.alt_recipe_id = rescue.id

            seen.add(key)
            entries.append(entry)

        used = {e.recipe_id for e in entries} | {e.alt_recipe_id for e in entries if e.alt_recipe_id}
        self.menu = entries
        self.recipes = [r for r in self.recipes if r.id in used]
        return self


ActionType = Literal["replace_meal", "update_spec", "add_item", "regenerate_all", "none"]


class ChatAction(Base):
    type: ActionType = "none"
    day_index: Annotated[int | None, Field(ge=0, le=13, alias="dayIndex")] = None
    slot: MealSlot | None = None
    reason: Annotated[str, Field(max_length=120)] = ""
    patch: dict = Field(default_factory=dict)
    name: Annotated[str, Field(max_length=60)] = ""
    qty: Annotated[float, Field(gt=0, le=2000)] = 1
    unit: Unit = "ud"

    _PATCH_KEYS = {"days", "slots", "maxMinutes", "budgetPerPersonDay", "excluded", "people"}

    @model_validator(mode="after")
    def _prune(self) -> ChatAction:
        self.patch = {k: v for k, v in self.patch.items() if k in self._PATCH_KEYS}
        if self.type == "add_item" and not self.name.strip():
            self.type = "none"
        return self


class ChatPayload(Base):
    reply: Annotated[str, Field(max_length=400)] = "Hecho."
    actions: Annotated[list[ChatAction], Field(max_length=8)] = Field(default_factory=list)

    @model_validator(mode="after")
    def _fill(self) -> ChatPayload:
        self.reply = self.reply.strip() or "Hecho."
        if not self.actions:
            self.actions = [ChatAction(type="none")]
        return self


# ---- Cuerpos de petición del front ----


class PlanRequest(Base):
    prompt: Annotated[str, Field(min_length=1, max_length=2000)]
    start_date: Annotated[str, Field(max_length=20, alias="startDate")] = ""


class MenuRequest(Base):
    spec: PlanSpec
    avoid_recipes: Annotated[list[str], Field(max_length=60, alias="avoidRecipes")] = Field(default_factory=list)
    hint: Annotated[str, Field(max_length=400)] = ""


class RecipeRequest(Base):
    spec: PlanSpec
    slot: MealSlot = "comida"
    replaces: Annotated[str, Field(max_length=90)] = ""
    hint: Annotated[str, Field(max_length=300)] = ""
    must_be_suitable_for: Annotated[str, Field(max_length=200, alias="mustBeSuitableFor")] = ""
    avoid_recipes: Annotated[list[str], Field(max_length=60, alias="avoidRecipes")] = Field(default_factory=list)


class ChatRequest(Base):
    message: Annotated[str, Field(min_length=1, max_length=800)]
    spec: PlanSpec
    menu_summary: Annotated[list[str], Field(max_length=40, alias="menuSummary")] = Field(default_factory=list)
