import { generateM3Tokens, type M3Tokens } from './m3-tokens';

let currentTokens: M3Tokens | null = null;

/**
 * Apply M3 color tokens to :root as CSS variables.
 *
 * @param seedHex - Seed color (e.g. '#1976d2' for ApartX blue)
 */
export function applyM3Theme(seedHex: string) {
  currentTokens = generateM3Tokens(seedHex);
  const isDark = document.documentElement.classList.contains('dark');
  applyTokens(isDark ? currentTokens.dark : currentTokens.light);
}

/**
 * Toggle dark/light mode. Reapplies tokens for the target mode.
 */
export function toggleDarkMode(dark?: boolean) {
  const isDark = dark ?? !document.documentElement.classList.contains('dark');
  document.documentElement.classList.toggle('dark', isDark);

  if (currentTokens) {
    applyTokens(isDark ? currentTokens.dark : currentTokens.light);
  }
}

/**
 * Check if dark mode is active.
 */
export function isDarkMode(): boolean {
  return document.documentElement.classList.contains('dark');
}

function applyTokens(tokens: Record<string, string>) {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(tokens)) {
    root.style.setProperty(key, value);
  }
}
