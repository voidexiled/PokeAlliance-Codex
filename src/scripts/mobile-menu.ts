// Controller of the phone sheet (spec 5.8, 7.10.3). No React: the sheet is a
// native `<dialog>` opened with `showModal()`, so focus is trapped inside it, the
// rest of the page is inert, Escape closes it through the native `cancel` event
// and the user agent gives focus back to whoever opened it. This module only adds
// what the element does not do on its own: the `aria-expanded` of the menu
// button, the focus on the close button, the click on the veil, the `ac:modal-open`
// notice and the close when the window grows past 1280.
//
// It runs on import, from the script block of `PageLayout.astro`, and does
// nothing on a page with no sheet.
import { layout } from '@/lib/design/shell-tokens';

/** Fixed id of the sheet: it is the `aria-controls` of the menu button (C-R4). */
const ID_HOJA = 'menu-movil';

/** From layout-bp-xl the sheet does not exist and the navigation is the column (5.8). */
const CONSULTA_XL = `(min-width: ${layout.layoutBpXl})`;

/** The element that opened the sheet, to give focus back when it closes. */
let disparadorActivo: HTMLElement | null = null;

function disparadores(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(`[aria-controls="${ID_HOJA}"]`)];
}

function marcarExpandido(expandido: boolean): void {
  for (const boton of disparadores()) {
    boton.setAttribute('aria-expanded', expandido ? 'true' : 'false');
  }
}

function abrir(hoja: HTMLDialogElement, disparador: HTMLElement): void {
  if (hoja.open) return;
  disparadorActivo = disparador;
  hoja.showModal();
  marcarExpandido(true);

  // The user agent focuses the first focusable element, which is the brand link;
  // 7.10.3 asks for the close button.
  const cerrar = hoja.querySelector<HTMLElement>('[data-ac-menu-close]');
  cerrar?.focus();

  // TT12: a modal that opens closes every tooltip, pinned ones included.
  hoja.dispatchEvent(new CustomEvent('ac:modal-open', { bubbles: true }));
}

/**
 * A click on the veil: with `showModal()` the click on `::backdrop` is dispatched
 * to the dialog itself, so the target is the sheet and the point is outside its
 * box. A click with no pointer behind it (`detail === 0`, the one a keyboard
 * sends when it activates a button) reports 0, 0 and is never a click on the veil.
 */
function esClicEnVelo(hoja: HTMLDialogElement, evento: MouseEvent): boolean {
  if (evento.target !== hoja || evento.detail === 0) return false;
  const caja = hoja.getBoundingClientRect();
  return (
    evento.clientX < caja.left ||
    evento.clientX > caja.right ||
    evento.clientY < caja.top ||
    evento.clientY > caja.bottom
  );
}

function conectar(): void {
  const hoja = document.getElementById(ID_HOJA);
  if (!(hoja instanceof HTMLDialogElement)) return;

  for (const boton of disparadores()) {
    boton.addEventListener('click', () => {
      abrir(hoja, boton);
    });
  }

  hoja.addEventListener('click', (evento) => {
    const objetivo = evento.target;
    if (objetivo instanceof Element && objetivo.closest('[data-ac-menu-close]')) {
      hoja.close();
      return;
    }
    if (esClicEnVelo(hoja, evento)) hoja.close();
  });

  // `close` covers every way out: Escape (`cancel`), the close button and the veil.
  hoja.addEventListener('close', () => {
    marcarExpandido(false);
    const disparador = disparadorActivo;
    disparadorActivo = null;
    if (disparador?.isConnected) disparador.focus();
  });

  const ancha = window.matchMedia(CONSULTA_XL);
  ancha.addEventListener('change', (evento) => {
    if (evento.matches && hoja.open) hoja.close();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', conectar, { once: true });
} else {
  conectar();
}
