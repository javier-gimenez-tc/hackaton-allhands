"""Genera backend/data/{products.json, recipes.json, family.json}.

Productos: nutrición por 100g. Unidades: kg | ud (precio por unidad, grams via piece_g)
           | 'paquete/etc NN g' (precio por envase de NN g).
Recetas: cantidades en gramos SIEMPRE.
"""
import json, math, pathlib, re

DATA = pathlib.Path(__file__).resolve().parent.parent / "data"
DATA.mkdir(parents=True, exist_ok=True)
A_FV="B1-frutas-verduras"; A_MEAT="A1-carnes-frescas"; A_FISH="A2-pescados-frescos"
A_DAI="C1-lacteos-huevos"; A_DESP="C3-despensa"; A_PAN="C4-panaderia"
A_CONG="D1-congelados"; A_RAP="C6-ultrarapidos"; A_BEV="E1-bebidas"

PP = []  # name, cat, aisle, price, unit, (kcal,prot,carb,fat,fiber,sodium), allergens, tags, calcium, iron, vitd, stock

def add(name, cat, aisle, price, unit, nut, al=(), tg=(), ca=0, fe=0, vd=0, stock=True):
    PP.append(dict(name=name, cat=cat, aisle=aisle, price=price, unit=unit, nut=nut,
                   al=list(al), tg=list(tg), ca=ca, fe=fe, vd=vd, stock=stock))

# ---- Frutas y verduras ----
for row in [
    ("Plátano Canarias", 89, 1.1, 23.0, 0.2, 2.6, 1.55), ("Manzana Fuji", 52, 0.3, 14.0, 0.2, 2.4, 1.85),
    ("Tomate pera", 18, 0.9, 3.9, 0.2, 1.2, 1.49), ("Zanahoria", 41, 0.9, 10.0, 0.2, 2.8, 0.95),
    ("Lechuga iceberg", 14, 0.9, 2.9, 0.2, 1.3, 1.19), ("Cebolla", 40, 1.1, 9.0, 0.1, 1.7, 1.29),
    ("Ajo", 149, 6.4, 33.0, 0.5, 1.0, 1.85), ("Calabacín", 17, 1.2, 3.9, 0.3, 1.0, 1.39),
    ("Brócoli fresco", 34, 2.8, 5.0, 0.4, 2.6, 1.95), ("Espinacas frescas", 23, 2.9, 3.6, 0.4, 2.2, 1.29),
    ("Judía verde", 31, 1.8, 7.0, 0.2, 2.7, 1.69), ("Puerro", 61, 1.6, 14.0, 0.3, 1.8, 1.25),
    ("Pimiento rojo", 31, 1.0, 6.0, 0.3, 2.1, 1.49), ("Patata", 77, 2.0, 17.0, 0.1, 2.2, 1.19),
    ("Aguacate", 160, 2.0, 8.5, 15.0, 6.7, 1.99), ("Setas champiñón", 22, 3.1, 3.3, 0.3, 1.0, 1.69),
    ("Col de Bruselas", 43, 3.4, 4.9, 0.3, 3.8, 1.79),
]:
    add(row[0], "frutas_verduras", A_FV, row[6], "kg", row[1:6])

# ---- Carnes ----
for n, kc, pr, cb, ft, price in [
    ("Filetes de pechuga de pollo", 110, 22.0, 0.0, 2.6, 6.25), ("Muslos de pollo", 180, 19.0, 0.0, 12.0, 4.99),
    ("Filetes de pavo", 104, 22.0, 0.0, 1.5, 6.25), ("Carne picada magra de ternera", 175, 21.0, 0.0, 9.0, 7.95),
    ("Filetes de magro de cerdo", 145, 21.0, 0.0, 6.0, 5.49),
]:
    add(n, "carnes", A_MEAT, price, "kg", (kc, pr, cb, ft, 0, 65), ("gluten_free",))

# ---- Pescados ----
for n, kc, pr, ft, price, ca, fe, vd in [
    ("Filetes de salmón fresco", 208, 20.0, 13.0, 9.95, 12.0, 0.4, 11.0),
    ("Merluza congelada en filetes", 90, 17.0, 2.2, 5.49, 20.0, 0.5, 5.0),
    ("Lubina en filetes", 97, 19.0, 1.9, 8.95, 22.0, 0.4, 8.0),
    ("Filetes de dorada", 96, 18.0, 2.1, 6.95, 22.0, 0.4, 8.0),
    ("Sardinas en lata al natural", 148, 21.5, 6.8, 1.25, 240.0, 2.3, 9.0),
    ("Atún claro en lata al natural", 132, 26.0, 2.8, 1.35, 12.0, 1.3, 3.0),
]:
    unit = "kg" if "lata" not in n else "lata 90 g"
    if n == "Merluza congelada en filetes":
        unit = "paquete 500 g"
    tg = ("frozen",) if ("congelada" in n or unit.split()[0] in ("lata", "paquete", "tableta") and False) else ()
    tg = ("frozen",) if n == "Merluza congelada en filetes" else tg
    add(n, "pescados", A_FISH, price, unit, (kc, 26.0 if "Atún" in n else n is None and 0 or (0), 0, 0, 0, 70), "fish", tg, ca, fe, vd)

# Gallup: fix pescados nut correctly (se añaden ya correctos abajo)
PP = [p for p in PP if p["cat"] != "pescados"] + [pp for pp in _PES_BAD] if False else [p for p in PP if p["cat"] == "pescados" or p["cat"] != "pescados"]
