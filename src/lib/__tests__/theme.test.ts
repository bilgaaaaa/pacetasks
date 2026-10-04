import { buildTheme, PALETTE_IDS, paletteUsesAccent } from "../theme";

// WCAG relative luminance contrast for "#RRGGBB" colors.
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("buildTheme palettes", () => {
  it("lets only Sage follow the accent pick", () => {
    expect(paletteUsesAccent("sage")).toBe(true);
    expect(paletteUsesAccent("pastel")).toBe(false);
    expect(buildTheme("light", "ocean", "sage").colors.accent).not.toBe(buildTheme("light", "sage", "sage").colors.accent);
    expect(buildTheme("light", "ocean", "pastel").colors.accent).toBe(buildTheme("light", "sage", "pastel").colors.accent);
  });

  for (const palette of PALETTE_IDS) {
    for (const scheme of ["light", "dark"] as const) {
      it(`keeps text readable in ${palette} ${scheme}`, () => {
        const { colors, hero } = buildTheme(scheme, "sage", palette);
        expect(contrast(colors.textPrimary, colors.surface)).toBeGreaterThanOrEqual(7);
        expect(contrast(colors.textSecondary, colors.background)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(colors.onAccent, colors.accentDark)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(colors.quickText, colors.quickFill)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(hero.title, hero.card)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(hero.ctaText, hero.ctaFill)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(hero.todayText, hero.todayFill)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});
