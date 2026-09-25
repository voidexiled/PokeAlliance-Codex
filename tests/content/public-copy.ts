import { cpSync, mkdirSync, symlinkSync } from 'node:fs';
import path from 'node:path';

/**
 * Folders of public/sprites/ that hold thousands of client sprites
 * (scripts/assets/extract-game-sprites.mjs). The copies of the repository that the
 * `pnpm content:check` tests edit link them instead of copying them: no test writes there,
 * and copying them once per test is what made those tests time out.
 */
const LINKED_SPRITE_FOLDERS = [path.join('items', 'cliente'), 'outfits'];

/**
 * Copies what `pnpm content:check` reads from public/ into `root`: public/sprites/ (its
 * large generated folders as links) and public/data/map/otmm/.
 */
export function copyPublicForCheck(repoRoot: string, root: string): void {
  const sprites = path.join(repoRoot, 'public', 'sprites');
  const target = path.join(root, 'public', 'sprites');
  const linked = LINKED_SPRITE_FOLDERS.map((folder) => path.join(sprites, folder));
  cpSync(sprites, target, {
    recursive: true,
    filter: (source) => !linked.includes(source),
  });
  for (const folder of LINKED_SPRITE_FOLDERS) {
    mkdirSync(path.dirname(path.join(target, folder)), { recursive: true });
    symlinkSync(path.join(sprites, folder), path.join(target, folder), 'junction');
  }
  cpSync(
    path.join(repoRoot, 'public', 'data', 'map', 'otmm'),
    path.join(root, 'public', 'data', 'map', 'otmm'),
    { recursive: true },
  );
}
