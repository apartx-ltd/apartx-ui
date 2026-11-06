export const DEFAULT_COLOR_PALETTE: readonly string[] = [
  '#e53935', '#ff5a5f', '#e65100', '#558b2f', '#19aa1e', '#00796b', '#00838f', '#1e88e5',
  '#003580', '#5e35b1', '#7e57c2', '#9c27b0', '#d81b60', '#6d4c41', '#607d8b', '#455a64',
];

/** Texts of ColorPalette / ColorPicker (the kit has no i18n). */
export type ColorLabels = {
  custom?: string;
  backToPalette?: string;
  reset?: string;
  hex?: string;
  default?: string;
  palette?: string;
};

/** Accepts only 6-digit hex (`#rrggbb` or `rrggbb`); 3-digit shorthand is rejected. */
export function normalizeHex(input: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(input.trim());
  return m ? `#${m[1].toLowerCase()}` : null;
}

function channels(hex: string): [number, number, number] {
  const h = normalizeHex(hex) ?? '#000000';
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function contrastTextColor(hex: string): '#ffffff' | '#1c1b1f' {
  return contrastRatio(hex, '#ffffff') >= contrastRatio(hex, '#1c1b1f') ? '#ffffff' : '#1c1b1f';
}

export function mutedHex(hex: string, alpha: number): string {
  const [r, g, b] = channels(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}
