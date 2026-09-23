// Minimal JSON Schema (draft 2020-12) validator for content/schemas. It covers
// the keywords those schemas use: $ref to local $defs, type (incl. arrays),
// enum, const, properties, required, additionalProperties, propertyNames,
// items, prefixItems, minItems, maxItems, minimum, maximum, minLength, pattern,
// allOf, if/then/else and not. Unknown keywords make it throw, so a schema
// edit that needs more support fails loudly instead of being ignored.

const KNOWN = new Set([
  '$schema',
  '$id',
  '$defs',
  '$ref',
  'title',
  'description',
  'type',
  'enum',
  'const',
  'properties',
  'required',
  'additionalProperties',
  'propertyNames',
  'items',
  'prefixItems',
  'minItems',
  'maxItems',
  'minimum',
  'maximum',
  'minLength',
  'pattern',
  'allOf',
  'if',
  'then',
  'else',
  'not',
]);

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
}

function matchesType(value, type) {
  const actual = typeOf(value);
  return actual === type || (type === 'number' && actual === 'integer');
}

function describe(value) {
  return JSON.stringify(value);
}

function pointer(path) {
  return path.length
    ? path
        .map((part) => (typeof part === 'number' ? `[${part}]` : `.${part}`))
        .join('')
        .slice(1)
    : '(raíz)';
}

/**
 * Validates `value` against `schema`. Returns a list of { path, message } in
 * Spanish; an empty list means the document is valid.
 * @param {unknown} value
 * @param {Record<string, unknown>} schema
 */
export function validateSchema(value, schema) {
  const root = schema;
  /** @type {{ path: string, message: string }[]} */
  const errors = [];

  function resolveRef(ref) {
    const match = /^#\/\$defs\/([^/]+)$/.exec(ref);
    const target = match ? root.$defs?.[match[1]] : undefined;
    if (!target) throw new Error(`$ref no soportada o inexistente: ${ref}`);
    return target;
  }

  /** @returns {{ path: (string|number)[], message: string }[]} */
  function check(node, data, path) {
    if (node === true) return [];
    if (node === false) return [{ path, message: 'no se permite este valor' }];
    for (const keyword of Object.keys(node))
      if (!KNOWN.has(keyword))
        throw new Error(`Palabra clave de JSON Schema no soportada: ${keyword}`);
    const found = [];
    const add = (message, at = path) => found.push({ path: at, message });

    if (node.$ref) found.push(...check(resolveRef(node.$ref), data, path));
    if (node.type !== undefined) {
      const types = Array.isArray(node.type) ? node.type : [node.type];
      if (!types.some((type) => matchesType(data, type))) {
        add(`se esperaba ${types.join(' o ')} y hay ${describe(data)}`);
        return found;
      }
    }
    if (node.enum && !node.enum.some((option) => option === data))
      add(`debe ser uno de: ${node.enum.map(describe).join(', ')}`);
    if ('const' in node && node.const !== data) add(`debe ser ${describe(node.const)}`);

    if (typeof data === 'string') {
      if (node.minLength !== undefined && data.length < node.minLength) add('no puede estar vacío');
      if (node.pattern && !new RegExp(node.pattern, 'u').test(data))
        add(`${describe(data)} no tiene el formato esperado`);
    }
    if (typeof data === 'number' && node.minimum !== undefined && data < node.minimum)
      add(`debe ser mayor o igual a ${node.minimum}`);
    if (typeof data === 'number' && node.maximum !== undefined && data > node.maximum)
      add(`debe ser menor o igual a ${node.maximum}`);

    if (Array.isArray(data)) {
      if (node.minItems !== undefined && data.length < node.minItems)
        add(`necesita al menos ${node.minItems} elemento(s)`);
      if (node.maxItems !== undefined && data.length > node.maxItems)
        add(`admite como máximo ${node.maxItems} elemento(s)`);
      const prefix = node.prefixItems ?? [];
      data.forEach((item, index) => {
        const itemSchema = index < prefix.length ? prefix[index] : node.items;
        if (itemSchema !== undefined) found.push(...check(itemSchema, item, [...path, index]));
      });
    }

    if (data && typeof data === 'object' && !Array.isArray(data)) {
      for (const key of node.required ?? [])
        if (!Object.hasOwn(data, key)) add(`falta el campo obligatorio "${key}"`);
      for (const [key, child] of Object.entries(data)) {
        if (node.propertyNames) {
          const nameErrors = check(node.propertyNames, key, [...path, key]);
          if (nameErrors.length)
            add(`la clave ${describe(key)} no tiene el formato esperado`, [...path, key]);
        }
        if (node.properties && Object.hasOwn(node.properties, key)) {
          found.push(...check(node.properties[key], child, [...path, key]));
        } else if (node.additionalProperties === false) {
          add(`campo no permitido: "${key}"`, [...path, key]);
        } else if (node.additionalProperties && typeof node.additionalProperties === 'object') {
          found.push(...check(node.additionalProperties, child, [...path, key]));
        }
      }
    }

    for (const part of node.allOf ?? []) found.push(...check(part, data, path));
    if (node.if !== undefined) {
      const passes = check(node.if, data, path).length === 0;
      if (passes && node.then !== undefined) found.push(...check(node.then, data, path));
      if (!passes && node.else !== undefined) found.push(...check(node.else, data, path));
    }
    if (node.not !== undefined && check(node.not, data, path).length === 0)
      add('el valor no está permitido aquí');
    return found;
  }

  for (const error of check(schema, value, [])) {
    errors.push({ path: pointer(error.path), message: error.message });
  }
  return errors;
}
