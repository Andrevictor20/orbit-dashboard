export interface WallpaperThemePalette {
  primary: string;
  primaryHover: string;
  contrastText: string;
  accent: string;
  glassShadow: string;
  dominantHex: string;
  secondaryHex: string;
}

export const DEFAULT_WALLPAPER_PALETTE: WallpaperThemePalette = {
  primary: '#818cf8',
  primaryHover: '#6366f1',
  contrastText: '#ffffff',
  accent: 'rgba(99, 102, 241, 0.15)',
  glassShadow: 'inset 0 1px 1.5px 0 rgba(255, 255, 255, 0.2), 0 20px 50px -10px rgba(99, 102, 241, 0.35)',
  dominantHex: '#818cf8',
  secondaryHex: '#c084fc',
};

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;
  if (h >= 0 && h < 60) {
    r = c; g = x; b = 0;
  } else if (h >= 60 && h < 120) {
    r = x; g = c; b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0; g = c; b = x;
  } else if (h >= 180 && h < 240) {
    r = 0; g = x; b = c;
  } else if (h >= 240 && h < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }

  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255)
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export async function extractPaletteFromImage(
  imageUrl: string,
  isDark = true
): Promise<WallpaperThemePalette> {
  return new Promise((resolve) => {
    if (!imageUrl || typeof window === 'undefined') {
      return resolve(DEFAULT_WALLPAPER_PALETTE);
    }

    const img = new window.Image();
    img.crossOrigin = 'anonymous';

    const timer = setTimeout(() => {
      resolve(DEFAULT_WALLPAPER_PALETTE);
    }, 2500);

    img.onload = () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        const size = 64;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          return resolve(DEFAULT_WALLPAPER_PALETTE);
        }

        ctx.drawImage(img, 0, 0, size, size);
        const imageData = ctx.getImageData(0, 0, size, size);
        const data = imageData.data;

        // 12 hue bins (0°, 30°, 60°, ...)
        const bins: Array<{
          count: number;
          totalSat: number;
          totalLight: number;
          rSum: number;
          gSum: number;
          bSum: number;
        }> = Array.from({ length: 12 }, () => ({
          count: 0,
          totalSat: 0,
          totalLight: 0,
          rSum: 0,
          gSum: 0,
          bSum: 0,
        }));

        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a < 128) continue;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          const [h, s, l] = rgbToHsl(r, g, b);
          // Ignore near-achromatic / low-contrast pixels
          if (s < 18 || l < 12 || l > 88) continue;

          const binIdx = Math.floor(h / 30) % 12;
          const bin = bins[binIdx];
          bin.count += 1;
          bin.totalSat += s;
          bin.totalLight += l;
          bin.rSum += r;
          bin.gSum += g;
          bin.bSum += b;
        }

        // Rank bins by saturation and chromatic vibrancy
        const ranked = bins
          .map((b, idx) => {
            if (b.count === 0) return { idx, score: 0, bin: b };
            const avgS = b.totalSat / b.count;
            const avgL = b.totalLight / b.count;
            // Balance vibrancy around L=55% and high S
            const lightPenalty = Math.abs(avgL - 55) * 1.3;
            const score = b.count * Math.pow(avgS / 100, 1.4) * Math.max(0.1, 1 - lightPenalty / 100);
            return { idx, score, bin: b };
          })
          .sort((a, b) => b.score - a.score);

        const best = ranked[0]?.score > 0 ? ranked[0] : null;
        if (!best || best.bin.count === 0) {
          return resolve(DEFAULT_WALLPAPER_PALETTE);
        }

        const primaryH = best.idx * 30 + 15;
        // Calibrate saturation and lightness for target UI theme mode
        const targetS = 78;
        const targetL = isDark ? 62 : 46;
        const hoverL = isDark ? 52 : 38;

        const [prR, prG, prB] = hslToRgb(primaryH, targetS, targetL);
        const [hovR, hovG, hovB] = hslToRgb(primaryH, targetS, hoverL);

        const primaryHex = rgbToHex(prR, prG, prB);
        const primaryHoverHex = rgbToHex(hovR, hovG, hovB);

        // Secondary hue (analogous or split-complementary)
        const secondaryH = (primaryH + 45) % 360;
        const [secR, secG, secB] = hslToRgb(secondaryH, 70, isDark ? 65 : 45);
        const secondaryHex = rgbToHex(secR, secG, secB);

        // Relative luminance for contrast
        const lum = 0.2126 * (prR / 255) + 0.7152 * (prG / 255) + 0.0722 * (prB / 255);
        const contrastText = lum > 0.58 ? '#000000' : '#ffffff';

        const palette: WallpaperThemePalette = {
          primary: primaryHex,
          primaryHover: primaryHoverHex,
          contrastText,
          accent: `rgba(${prR}, ${prG}, ${prB}, 0.15)`,
          glassShadow: `inset 0 1px 1.5px 0 rgba(255, 255, 255, 0.2), 0 20px 50px -10px rgba(${prR}, ${prG}, ${prB}, 0.30)`,
          dominantHex: primaryHex,
          secondaryHex: secondaryHex,
        };

        resolve(palette);
      } catch {
        resolve(DEFAULT_WALLPAPER_PALETTE);
      }
    };

    img.onerror = () => {
      clearTimeout(timer);
      resolve(DEFAULT_WALLPAPER_PALETTE);
    };

    img.src = imageUrl;
  });
}
