/** Цвет образца: HEX и RGB. Чистые функции — для показа, проверки ввода и тестов. */

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** «#abc», «AABBCC» → «#AABBCC»; null — не цвет. */
export function normalizeHex(input: string): string | null {
  const match = HEX.exec(input.trim());
  const digits = match?.[1];
  if (digits === undefined) return null;
  const full = digits.length === 3 ? digits.replace(/./g, '$&$&') : digits;
  return `#${full.toUpperCase()}`;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const value = Number.parseInt(hex.slice(1), 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

export function rgbText(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${String(r)}, ${String(g)}, ${String(b)})`;
}

/** Тёмный ли цвет (подписи на образце — светлые). Яркость по WCAG. */
export function isDark(hex: string): boolean {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b) < 0.4;
}
