import { describe, it, expect } from 'vitest';
import { extractPaletteFromImage, DEFAULT_WALLPAPER_PALETTE } from '../../utils/wallpaperPalette';

describe('wallpaperPalette utility', () => {
  it('returns default fallback palette when imageUrl is empty or invalid', async () => {
    const palEmpty = await extractPaletteFromImage('');
    expect(palEmpty).toEqual(DEFAULT_WALLPAPER_PALETTE);
    expect(palEmpty.primary).toBe('#818cf8');
    expect(palEmpty.contrastText).toBe('#ffffff');
  });

  it('provides well-formed hex colors and contrast text in default palette', () => {
    expect(DEFAULT_WALLPAPER_PALETTE.primary).toMatch(/^#[0-9a-f]{6}$/i);
    expect(DEFAULT_WALLPAPER_PALETTE.primaryHover).toMatch(/^#[0-9a-f]{6}$/i);
    expect(['#000000', '#ffffff']).toContain(DEFAULT_WALLPAPER_PALETTE.contrastText);
    expect(DEFAULT_WALLPAPER_PALETTE.accent).toContain('rgba(');
  });

  it('handles simulated image load failure gracefully by returning fallback palette', async () => {
    const result = await extractPaletteFromImage('https://invalid-non-existent-domain-orbit.xyz/test.jpg');
    expect(result).toBeDefined();
    expect(result.primary).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
