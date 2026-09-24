// GENERADO por scripts/design/tokens.mjs desde src/design/tokens.json. No editar.

// Los mismos valores que src/styles/tokens.css, para el código que no lee CSS
// (<meta name="theme-color"> y el PNG del ranking de Guild).

/** Colores del tema «Oscuro». */
export const color = {
  bgPrimary: '#0c0e12',
  bgSecondary: '#13161b',
  bgTertiary: '#22262f',
  bgQuaternary: '#373a41',
  borderSecondary: '#22262f',
  borderPrimary: '#373a41',
  textPrimary: '#f7f7f7',
  textSecondary: '#cecfd2',
  textTertiary: '#94979c',
  textQuaternary: '#85888e',
  textQuinary: '#61656c',
  helper: '#a1a1aa',
  link: '#93c5fd',
  linkProse: '#3b82f6',
  white: '#ffffff',
  black: '#000000',
  ring: '#444ce7',
  selected: '#d97706',
  amber: '#f59e0b',
  success: '#22c55e',
  discord: '#5865f2',
  googleSurface: '#131314',
  googleBorder: '#8e918f',
  googleText: '#e3e3e3',
  twitch: '#9146ff',
  banner: '#991b1b',
  inactiveRow: 'rgba(153, 27, 27, 0.18)',
  overlay: '#000000cc',
  ttPanel: '#21252c',
  ttPanelDeep: '#1d232b',
  ttTrack: '#262b32',
  ttDivider: '#2e343d',
  ttLabel: '#e8c66a',
  ttValue: '#ffffff',
  ttMuted: '#9aa0a8',
  ttHint: '#8a91a0',
  ttShiny: '#4a9eff',
  tierRowMythic: '#4b252b',
  tierRowLegendary: '#4b3025',
  tierRowUltraRare: '#4b3c25',
  tierRowSuperRare: '#4b4625',
  tierRowT1: '#3e4b25',
  tierRowT2: '#284b25',
  tierRowT3: '#254b3b',
  tierRowT4: '#25484b',
  tierRowT5: '#25384b',
  tierRowT6: '#25284b',
  tierRowT7: '#32254b',
  shinyGlow: '#e8c66a',
  tierUltimate: '#ff6b6b',
  tierMythic: '#f0abfc',
  tierLegendary: '#fbbf24',
  tierUltraRare: '#c4b5fd',
  tierSuperRare: '#7dd3fc',
  tierT1: '#f7f7f7',
  tierT2: '#e2e3e5',
  tierT3: '#cecfd2',
  tierT4: '#b8babe',
  tierT5: '#a6a8ad',
  tierT6: '#95989d',
  tierT7: '#85888e',
} as const;

/** Familias tipográficas (type.families). */
export const fontFamily = {
  sans: 'Verdana, "DejaVu Sans", "Bitstream Vera Sans", system-ui, sans-serif',
  game: 'Poppins, Verdana, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
} as const;

/** Los 22 estilos de texto (§4.1). */
export const type = {
  h1: {
    fontSize: '30px',
    lineHeight: '36px',
    fontWeight: 700,
    fontFamily: 'sans',
  },
  h1Sub: {
    fontSize: '18px',
    lineHeight: '28px',
    fontWeight: 700,
    fontFamily: 'sans',
  },
  h2: {
    fontSize: '20px',
    lineHeight: '28px',
    fontWeight: 700,
    fontFamily: 'sans',
  },
  h3: {
    fontSize: '16px',
    lineHeight: '24px',
    fontWeight: 700,
    fontFamily: 'sans',
  },
  brand: {
    fontSize: '18px',
    lineHeight: '28px',
    fontWeight: 700,
    fontFamily: 'sans',
    letterSpacing: '-0.2px',
  },
  figure: {
    fontSize: '18px',
    lineHeight: '28px',
    fontWeight: 700,
    fontFamily: 'sans',
  },
  base: {
    fontSize: '16px',
    lineHeight: '24px',
    fontWeight: 400,
    fontFamily: 'sans',
  },
  body: {
    fontSize: '14px',
    lineHeight: '22px',
    fontWeight: 400,
    fontFamily: 'sans',
  },
  bodyStrong: {
    fontSize: '14px',
    lineHeight: '22px',
    fontWeight: 700,
    fontFamily: 'sans',
  },
  note: {
    fontSize: '14px',
    lineHeight: '22px',
    fontWeight: 400,
    fontFamily: 'sans',
    fontStyle: 'italic',
  },
  field: {
    fontSize: '14px',
    lineHeight: '20px',
    fontWeight: 400,
    fontFamily: 'sans',
  },
  factLine: {
    fontSize: '14px',
    lineHeight: '32px',
    fontWeight: 400,
    fontFamily: 'sans',
  },
  ui: {
    fontSize: '12px',
    lineHeight: '16px',
    fontWeight: 400,
    fontFamily: 'sans',
  },
  uiStrong: {
    fontSize: '12px',
    lineHeight: '16px',
    fontWeight: 700,
    fontFamily: 'sans',
  },
  uiCaps: {
    fontSize: '12px',
    lineHeight: '16px',
    fontWeight: 700,
    fontFamily: 'sans',
    letterSpacing: '1.2px',
    textTransform: 'uppercase',
  },
  uiStep: {
    fontSize: '12px',
    lineHeight: '16px',
    fontWeight: 700,
    fontFamily: 'sans',
    fontStyle: 'italic',
  },
  uiFeatured: {
    fontSize: '12px',
    lineHeight: '16.5px',
    fontWeight: 400,
    fontFamily: 'sans',
  },
  uiLoose: {
    fontSize: '12px',
    lineHeight: '20px',
    fontWeight: 400,
    fontFamily: 'sans',
  },
  kbd: {
    fontSize: '12px',
    lineHeight: '22px',
    fontWeight: 400,
    fontFamily: 'mono',
  },
  ttTitle: {
    fontSize: '15px',
    lineHeight: '20px',
    fontWeight: 600,
    fontFamily: 'game',
    letterSpacing: '0.35em',
    textTransform: 'uppercase',
  },
  ttRow: {
    fontSize: '12px',
    lineHeight: '21px',
    fontWeight: 600,
    fontFamily: 'game',
    letterSpacing: '0.03em',
  },
  ttHint: {
    fontSize: '12px',
    lineHeight: '16px',
    fontWeight: 500,
    fontFamily: 'game',
    letterSpacing: '0.02em',
  },
} as const;

/** Escala de espaciado; el número del nombre es el valor en px. */
export const spacing = {
  space2: '2px',
  space4: '4px',
  space6: '6px',
  space8: '8px',
  space10: '10px',
  space12: '12px',
  space16: '16px',
  space20: '20px',
  space24: '24px',
  space32: '32px',
  space40: '40px',
  space48: '48px',
} as const;

/** Radios de esquina. */
export const radius = {
  radius2: '2px',
  radius3: '3px',
  radius4: '4px',
  radius6: '6px',
  radius8: '8px',
  radius10: '10px',
  radius11: '11px',
  radius12: '12px',
  radiusFull: '9999px',
} as const;

/** Anillos y sombras de texto; no hay sombras de elevación. */
export const shadow = {
  ringSelected: '0 0 0 1px #d97706',
  glowShiny: 'drop-shadow(0 0 1.5px rgba(232, 198, 106, 0.95)) drop-shadow(0 0 6px rgba(232, 198, 106, 0.55))',
  textShadowGame: '0 1px 1px rgba(0, 0, 0, 0.85)',
  insetMissing: 'inset 0 0 0 1px #373a41',
  insetTtEmpty: 'inset 0 0 0 1px #2e343d',
} as const;

/** Medidas del marco. */
export const layout = {
  layoutHeader: '64px',
  layoutSidebar: '208px',
  layoutGap: '40px',
  layoutMainRail: '896px',
  layoutMain: '944px',
  layoutMainFull: '1192px',
  layoutMainMax: '1536px',
  layoutRail: '256px',
  layoutRailContent: '240px',
  layoutSpacer: '208px',
  layoutSheet: '288px',
  layoutSearch: '448px',
  layoutBpMd: '768px',
  layoutBpXl: '1280px',
  layoutDexCompact: '495px',
} as const;

/** Cajas fijas de sprites y controles. */
export const size = {
  sizeCell: '32px',
  sizeStage: '72px',
  sizeArt: '64px',
  sizeSlot: '40px',
  sizeSlotDrop: '36px',
  sizeSlotHeld: '32px',
  sizeMissing: '16px',
  sizeSpriteNav: '16px',
  sizeSpritePanel: '24px',
  sizeSpriteFeatured: '36px',
  sizeTtHead: '70px',
  sizeControl: '40px',
  sizeTouch: '44px',
  sizeTab: '50px',
  sizeChip: '24px',
  sizeMeter: '4px',
  sizeTt: '282px',
  sizeTtNarrow: '240px',
  sizeTtWide: '300px',
  sizeTtChart: '200px',
  sizeTtTier: '184px',
  sizeBar: '24px',
  sizePlot: '220px',
  sizeSparkW: '68px',
  sizeSparkH: '20px',
} as const;

/** Ancho mínimo de tarjeta por familia de rejilla. */
export const grid = {
  gridListing: '280px',
  gridDex: '260px',
  gridLoot: '240px',
  gridFeatured: '200px',
  gridIndex: '290px',
  gridKpi: '200px',
  gridInfo: '280px',
  gridCompact: '240px',
} as const;

/** Opacidades. */
export const opacity = {
  opacityChevron: '0.5',
  opacityPartial: '0.45',
  opacityShinyBack: '0.6',
} as const;

/** Capas z. */
export const zIndex = {
  zHeader: '30',
  zTooltip: '40',
  zListbox: '45',
  zScrim: '50',
  zSheet: '51',
  zSkip: '60',
} as const;

/** Duraciones y curvas del movimiento. */
export const motion = {
  durationFast: '150ms',
  durationSpriteIn: '300ms',
  durationSheet: '500ms',
  durationPulse: '2s',
  durationBounce: '5s',
  durationSpin: '800ms',
  easeStandard: 'cubic-bezier(0.4, 0, 0.2, 1)',
  easePulse: 'cubic-bezier(0.4, 0, 0.6, 1)',
  easeBounce: 'ease-in-out',
} as const;

/** Todos los grupos de src/design/tokens.json en un solo objeto. */
export const tokens = {
  color,
  fontFamily,
  type,
  spacing,
  radius,
  shadow,
  layout,
  size,
  grid,
  opacity,
  zIndex,
  motion,
} as const;

export type Tokens = typeof tokens;
