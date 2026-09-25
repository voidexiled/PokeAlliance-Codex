// @ts-check
// The content versions of the game images (spec 7.4.1): the first 8 hex digits of a SHA-256
// over every file of a folder of public/, path and bytes, in path order. astro.config.mjs hands
// them to the code as `__AC_SPRITES_VERSION__` and `__AC_POKEMON_ART_VERSION__`, and every URL
// of a sprite or of a Pokémon's art carries its folder's version (`?v=1a2b3c4d`), so a file that
// changes under the same name (a 7-frame strip that became a 22-frame one) is a new URL that no
// browser or CDN has cached. The hash reads the bytes, not the dates, so the same files give
// the same version on every machine and every clone, and a deploy that does not touch the
// images does not invalidate them.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Every file under `dir`, as paths relative to it with `/`, sorted.
 * @param {string} dir
 * @returns {string[]}
 */
function listFiles(dir) {
  /** @type {string[]} */
  const files = [];
  /** @param {string} folder */
  const walk = (folder) => {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const path = join(folder, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) files.push(relative(dir, path).split('\\').join('/'));
    }
  };
  walk(dir);
  return files.sort();
}

/**
 * The version of a folder: 8 hex digits of the SHA-256 of each file's path and bytes, or `''`
 * when the folder does not exist (the URLs then go without `?v=`).
 * @param {string} dir
 * @returns {string}
 */
export function folderVersion(dir) {
  if (!existsSync(dir)) return '';
  const hash = createHash('sha256');
  for (const file of listFiles(dir)) {
    hash.update(file);
    hash.update('\0');
    hash.update(
      createHash('sha256')
        .update(readFileSync(join(dir, file)))
        .digest(),
    );
  }
  return hash.digest('hex').slice(0, 8);
}
