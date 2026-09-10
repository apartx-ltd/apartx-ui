import {
  Hct,
  argbFromHex,
  hexFromArgb,
  DynamicScheme,
  MaterialDynamicColors,
  TonalPalette,
  Variant,
} from '@material/material-color-utilities';

export interface ThemeTokens {
  light: Record<string, string>;
  dark: Record<string, string>;
}

// Tonal surface-container roles. MCU's Scheme doesn't expose these directly —
// they're derived from the neutral palette at fixed tones (different per light/dark).
// Tones per the M3 spec (https://m3.material.io/styles/color/roles).
const SURFACE_TONES_LIGHT: Record<string, number> = {
  '--theme-surface-dim': 87,
  '--theme-surface-bright': 98,
  '--theme-surface-container-lowest': 100,
  '--theme-surface-container-low': 96,
  '--theme-surface-container': 94,
  '--theme-surface-container-high': 92,
  '--theme-surface-container-highest': 90,
};
// Dark is Night: page background at T7, surface at T12 (M3 puts both on T6), containers
// above the surface. The stock M3 ladder (4/6/10/12/17/22) is shifted up as a whole so the
// order background < surface < containers holds.
const SURFACE_TONES_DARK: Record<string, number> = {
  '--theme-surface-dim': 7,
  '--theme-surface-bright': 24,
  '--theme-surface-container-lowest': 7,
  '--theme-surface-container-low': 12,
  '--theme-surface-container': 15,
  '--theme-surface-container-high': 18,
  '--theme-surface-container-highest': 23,
};

// M3 roles → DynamicColor names. Second element is a plain `string`, not a keyof:
// MaterialDynamicColors also carries non-DynamicColor statics, so an exact keyof
// would let those through.
const ROLE_TOKENS: Array<[string, string]> = [
  ['--theme-primary', 'primary'],
  ['--theme-on-primary', 'onPrimary'],
  ['--theme-primary-container', 'primaryContainer'],
  ['--theme-on-primary-container', 'onPrimaryContainer'],
  ['--theme-secondary', 'secondary'],
  ['--theme-on-secondary', 'onSecondary'],
  ['--theme-secondary-container', 'secondaryContainer'],
  ['--theme-on-secondary-container', 'onSecondaryContainer'],
  ['--theme-tertiary', 'tertiary'],
  ['--theme-on-tertiary', 'onTertiary'],
  ['--theme-tertiary-container', 'tertiaryContainer'],
  ['--theme-on-tertiary-container', 'onTertiaryContainer'],
  ['--theme-error', 'error'],
  ['--theme-on-error', 'onError'],
  ['--theme-error-container', 'errorContainer'],
  ['--theme-on-error-container', 'onErrorContainer'],
  ['--theme-background', 'background'],
  ['--theme-on-background', 'onBackground'],
  ['--theme-surface', 'surface'],
  ['--theme-on-surface', 'onSurface'],
  ['--theme-surface-variant', 'surfaceVariant'],
  ['--theme-on-surface-variant', 'onSurfaceVariant'],
  ['--theme-outline', 'outline'],
  ['--theme-outline-variant', 'outlineVariant'],
  ['--theme-shadow', 'shadow'],
  ['--theme-scrim', 'scrim'],
  ['--theme-inverse-surface', 'inverseSurface'],
  ['--theme-inverse-on-surface', 'inverseOnSurface'],
  ['--theme-inverse-primary', 'inversePrimary'],
];

function extractScheme(scheme: DynamicScheme): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [token, role] of ROLE_TOKENS) {
    out[token] = hexFromArgb((MaterialDynamicColors as any)[role].getArgb(scheme));
  }
  return {
    ...out,
    // Custom semantic colors (outside the M3 role set)
    '--theme-success': '#2e7d32',
    '--theme-on-success': '#ffffff',
    '--theme-warning': '#ed6c02',
    '--theme-on-warning': '#ffffff',
    '--theme-info': '#0288d1',
    '--theme-on-info': '#ffffff',
  };
}

// The scheme is assembled by hand rather than taken ready-made from
// `themeFromSourceColor` (which is TonalSpot): that one caps the seed's chroma at 36 and
// reads the accent off tone 40, dragging the brand blue #1976d2 towards #005faf, while its
// neutrals (chroma 6/8) tint every grey. Values below match TonalSpot except the
// deliberate departures marked ★. Kept in step with apartx-brands/theme/gen-theme.mjs,
// which generates the same palette as static CSS for the apps.
function schemeFor(src: Hct, isDark: boolean): DynamicScheme {
  // ★ Light: greys with no tint. Dark is Night: the seed's hue at chroma 12. An achromatic
  // seed (astanahub, #000) has no defined hue and a tint would come out random, so below
  // chroma 5 the neutrals stay grey in dark as well.
  const neutralChroma = isDark && src.chroma >= 5 ? 12 : 0;
  return new DynamicScheme({
    sourceColorHct: src,
    variant: Variant.TONAL_SPOT,
    contrastLevel: 0,
    isDark,
    primaryPalette: TonalPalette.fromHueAndChroma(src.hue, src.chroma), // ★ seed chroma, uncapped
    secondaryPalette: TonalPalette.fromHueAndChroma(src.hue, 16),
    tertiaryPalette: TonalPalette.fromHueAndChroma(src.hue + 60, 24),
    neutralPalette: TonalPalette.fromHueAndChroma(src.hue, neutralChroma), // ★
    neutralVariantPalette: TonalPalette.fromHueAndChroma(src.hue, neutralChroma), // ★
  });
}

/**
 * Generate color tokens from a seed color.
 * Returns `--theme-*` CSS variable values for light and dark schemes.
 *
 * @param seedHex - Seed color in hex (e.g. '#6750A4')
 * @returns ThemeTokens with light and dark color maps
 */
export function generateTokens(seedHex: string): ThemeTokens {
  const src = Hct.fromInt(argbFromHex(seedHex));

  const build = (isDark: boolean): Record<string, string> => {
    const scheme = schemeFor(src, isDark);
    const tokens = extractScheme(scheme);

    // Accent. Light: the seed's tone, but no lighter than 42 — lighter, the accent as text
    // loses AA on light containers (#1976d2 at tone 49 gave 3.6:1 on #e2e2e2, tone 42
    // gives 4.6:1). A dark seed (astanahub, tone 0) stays as is. Dark: tone 72 rather than
    // the stock 80 — richer, and the text on it (on-primary, tone 20) still holds 6.1:1.
    tokens['--theme-primary'] = hexFromArgb(
      scheme.primaryPalette.tone(isDark ? 72 : Math.min(src.tone, 42)),
    );

    // Dark is Night: the page background (painted by <Page> via bg-background) sits below
    // the surface used by bars and panels. M3 puts both roles on T6.
    if (isDark) {
      tokens['--theme-background'] = hexFromArgb(scheme.neutralPalette.tone(7));
      tokens['--theme-surface'] = hexFromArgb(scheme.neutralPalette.tone(12));
    }

    const tones = isDark ? SURFACE_TONES_DARK : SURFACE_TONES_LIGHT;
    for (const key in tones) {
      tokens[key] = hexFromArgb(scheme.neutralPalette.tone(tones[key]));
    }

    return tokens;
  };

  return { light: build(false), dark: build(true) };
}
