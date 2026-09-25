// The drawn size of a sprite in the 16 px box of the menu (owner rule 2026-09-25; DS:Sidebar).
// No imports, so src/lib/nav/groups.ts, the unit tests and the Playwright specs share one rule.
//
// The menu draws game art of many sizes: Market category icons of 16 to 28, crops of the
// client's items, its top-bar buttons of 28 to 35 and item tiles of 32. So that a row keeps one
// size, art up to `ARTE_NITIDO` on its longest side is drawn at 1x, crisp, and larger art is
// scaled down smoothly until it measures `ARTE_MENU`. Both reach a little past the box of 16,
// into the 8 before the label and the padding of the row. An illustration (a frame over 64,
// drawn `smooth` by the adapter) is fitted to the box.

/** The side of the box (`--size-sprite-nav`, sidebar.css). */
export const SPRITE_NAV = 16;
/** The longest side of art the menu still draws at 1x. */
export const ARTE_NITIDO = 20;
/** The longest side larger art is scaled down to. */
export const ARTE_MENU = 18;

/**
 * The longest side of the visible art of the menu sprites whose frame has room around the art:
 * the item tiles of 32 and the 35 of a top-bar button. Measured from the PNG of each key;
 * tests/nav/groups.test.ts measures them again, so a new PNG fails the test until its figure is
 * updated here. A key not listed is read as art as large as its frame.
 */
export const ARTE_EN_MARCO: Readonly<Record<string, number>> = {
  'ui/inicio': 17,
  'ui/diamond': 21,
  'ui/indice/sistemas': 24,
  'outfits/138': 24,
  'ui/nav/destacados': 30,
  // Icons of the site's own item categories (content/items/categorias.json): client item tiles.
  'items/cliente/23312': 24,
  'items/cliente/39090': 30,
  'items/cliente/50394': 31,
  'items/cliente/29365': 31,
};

/**
 * The size the menu draws a sprite at, or `null` for 1x.
 *
 * @param key Its key in public/sprites/sprites.json.
 * @param frame Its registered `frame`, [width, height].
 * @param smooth An illustration, as the adapter marks it.
 */
export function menuSpriteSize(
  key: string,
  frame: readonly [number, number],
  smooth: boolean,
): { width: number; height: number } | null {
  const [width, height] = frame;
  const side = Math.max(width, height);
  if (smooth) {
    return {
      width: Math.round((width * SPRITE_NAV) / side),
      height: Math.round((height * SPRITE_NAV) / side),
    };
  }
  const art = Object.hasOwn(ARTE_EN_MARCO, key) ? ARTE_EN_MARCO[key] : side;
  if (art <= ARTE_NITIDO) return null;
  const k = ARTE_MENU / art;
  return { width: Math.round(width * k), height: Math.round(height * k) };
}
