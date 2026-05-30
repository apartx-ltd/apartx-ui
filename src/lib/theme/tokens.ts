import {
  argbFromHex,
  themeFromSourceColor,
  hexFromArgb,
  type Theme,
} from '@material/material-color-utilities';

export interface ThemeTokens {
  light: Record<string, string>;
  dark: Record<string, string>;
}

/**
 * Generate color tokens from a seed color.
 * Returns `--theme-*` CSS variable values for light and dark schemes.
 *
 * @param seedHex - Seed color in hex (e.g. '#6750A4')
 * @returns ThemeTokens with light and dark color maps
 */
export function generateTokens(seedHex: string): ThemeTokens {
  const theme = themeFromSourceColor(argbFromHex(seedHex));

  function extractScheme(scheme: any): Record<string, string> {
    return {
      '--theme-primary': hexFromArgb(scheme.primary),
      '--theme-on-primary': hexFromArgb(scheme.onPrimary),
      '--theme-primary-container': hexFromArgb(scheme.primaryContainer),
      '--theme-on-primary-container': hexFromArgb(scheme.onPrimaryContainer),
      '--theme-secondary': hexFromArgb(scheme.secondary),
      '--theme-on-secondary': hexFromArgb(scheme.onSecondary),
      '--theme-secondary-container': hexFromArgb(scheme.secondaryContainer),
      '--theme-on-secondary-container': hexFromArgb(scheme.onSecondaryContainer),
      '--theme-tertiary': hexFromArgb(scheme.tertiary),
      '--theme-on-tertiary': hexFromArgb(scheme.onTertiary),
      '--theme-tertiary-container': hexFromArgb(scheme.tertiaryContainer),
      '--theme-on-tertiary-container': hexFromArgb(scheme.onTertiaryContainer),
      '--theme-error': hexFromArgb(scheme.error),
      '--theme-on-error': hexFromArgb(scheme.onError),
      '--theme-error-container': hexFromArgb(scheme.errorContainer),
      '--theme-on-error-container': hexFromArgb(scheme.onErrorContainer),
      '--theme-background': hexFromArgb(scheme.background),
      '--theme-on-background': hexFromArgb(scheme.onBackground),
      '--theme-surface': hexFromArgb(scheme.surface),
      '--theme-on-surface': hexFromArgb(scheme.onSurface),
      '--theme-surface-variant': hexFromArgb(scheme.surfaceVariant),
      '--theme-on-surface-variant': hexFromArgb(scheme.onSurfaceVariant),
      '--theme-outline': hexFromArgb(scheme.outline),
      '--theme-outline-variant': hexFromArgb(scheme.outlineVariant),
      '--theme-shadow': hexFromArgb(scheme.shadow),
      '--theme-scrim': hexFromArgb(scheme.scrim),
      '--theme-inverse-surface': hexFromArgb(scheme.inverseSurface),
      '--theme-inverse-on-surface': hexFromArgb(scheme.inverseOnSurface),
      '--theme-inverse-primary': hexFromArgb(scheme.inversePrimary),
      // Custom semantic colors (derived from palette)
      '--theme-success': '#2e7d32',
      '--theme-on-success': '#ffffff',
      '--theme-warning': '#ed6c02',
      '--theme-on-warning': '#ffffff',
      '--theme-info': '#0288d1',
      '--theme-on-info': '#ffffff',
    };
  }

  return {
    light: extractScheme(theme.schemes.light),
    dark: extractScheme(theme.schemes.dark),
  };
}
