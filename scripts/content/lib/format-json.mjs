// Writes content JSON the way the files in content/ are formatted (Prettier's
// style): two-space indent, and arrays of plain values on one line when the
// line fits in 100 characters.

const PRINT_WIDTH = 100;

/** @param {unknown} value */
export function formatJson(value) {
  const text = JSON.stringify(value, null, 2);
  return `${text.replace(/\[\n\s+([^[\]{}]*?)\n\s*\]/g, (match, inner, offset) => {
    const line = `[${inner.split(/,\n\s+/).join(', ')}]`;
    const lineStart = text.lastIndexOf('\n', offset) + 1;
    const lineEnd = text.indexOf('\n', offset + match.length);
    const after = lineEnd === -1 ? '' : text.slice(offset + match.length, lineEnd);
    const width = offset - lineStart + line.length + after.length;
    return width <= PRINT_WIDTH ? line : match;
  })}\n`;
}
