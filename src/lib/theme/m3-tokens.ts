import {
  argbFromHex,
  themeFromSourceColor,
  hexFromArgb,
  type Theme,
} from '@material/material-color-utilities';

export interface M3Tokens {
  light: Record<string, string>;
  dark: Record<string, string>;
}

/**
 * Generate Material 3 color tokens from a seed color.
 * Returns CSS variable values for light and dark schemes.
 *
 * @param seedHex - Seed color in hex (e.g. '#6750A4')
 * @returns M3Tokens with light and dark color maps
 */
export function generateM3Tokens(seedHex: string): M3Tokens {
  const theme = themeFromSourceColor(argbFromHex(seedHex));

  function extractScheme(scheme: any): Record<string, string> {
    return {
      '--m3-primary': hexFromArgb(scheme.primary),
      '--m3-on-primary': hexFromArgb(scheme.onPrimary),
      '--m3-primary-container': hexFromArgb(scheme.primaryContainer),
      '--m3-on-primary-container': hexFromArgb(scheme.onPrimaryContainer),
      '--m3-secondary': hexFromArgb(scheme.secondary),
      '--m3-on-secondary': hexFromArgb(scheme.onSecondary),
      '--m3-secondary-container': hexFromArgb(scheme.secondaryContainer),
      '--m3-on-secondary-container': hexFromArgb(scheme.onSecondaryContainer),
      '--m3-tertiary': hexFromArgb(scheme.tertiary),
      '--m3-on-tertiary': hexFromArgb(scheme.onTertiary),
      '--m3-tertiary-container': hexFromArgb(scheme.tertiaryContainer),
      '--m3-on-tertiary-container': hexFromArgb(scheme.onTertiaryContainer),
      '--m3-error': hexFromArgb(scheme.error),
      '--m3-on-error': hexFromArgb(scheme.onError),
      '--m3-error-container': hexFromArgb(scheme.errorContainer),
      '--m3-on-error-container': hexFromArgb(scheme.onErrorContainer),
      '--m3-background': hexFromArgb(scheme.background),
      '--m3-on-background': hexFromArgb(scheme.onBackground),
      '--m3-surface': hexFromArgb(scheme.surface),
      '--m3-on-surface': hexFromArgb(scheme.onSurface),
      '--m3-surface-variant': hexFromArgb(scheme.surfaceVariant),
      '--m3-on-surface-variant': hexFromArgb(scheme.onSurfaceVariant),
      '--m3-outline': hexFromArgb(scheme.outline),
      '--m3-outline-variant': hexFromArgb(scheme.outlineVariant),
      '--m3-shadow': hexFromArgb(scheme.shadow),
      '--m3-scrim': hexFromArgb(scheme.scrim),
      '--m3-inverse-surface': hexFromArgb(scheme.inverseSurface),
      '--m3-inverse-on-surface': hexFromArgb(scheme.inverseOnSurface),
      '--m3-inverse-primary': hexFromArgb(scheme.inversePrimary),
      // Custom semantic colors (derived from palette)
      '--m3-success': '#2e7d32',
      '--m3-on-success': '#ffffff',
      '--m3-warning': '#ed6c02',
      '--m3-on-warning': '#ffffff',
      '--m3-info': '#0288d1',
      '--m3-on-info': '#ffffff',
    };
  }

  return {
    light: extractScheme(theme.schemes.light),
    dark: extractScheme(theme.schemes.dark),
  };
}
