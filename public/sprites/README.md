# Sprites

Imágenes del juego que usa el sitio. `sprites.json` registra cada una con una clave (`ui/diamond`, `items/stones/fire-stone`, `outfits/7`).

- `ui/`: interfaz (Diamond, Pokédólares, balls, iconos de categorías, iconos de Comercio en `ui/comercio/`).
- `items/<categoria>/`: items del Market.
- `outfits/<outfitId>/`: frame idle de cada dirección (`norte`, `este`, `sur`, `oeste`). Los crea `pnpm assets:outfits -- --id <id> --registrar`.

Las hojas son tiras horizontales de frames iguales. Cómo añadir sprites y modos (`estatico`, `variante`, `cantidad`, `animacion`): `docs/REGISTROS.md`. Comprobar: `pnpm content:check`.
