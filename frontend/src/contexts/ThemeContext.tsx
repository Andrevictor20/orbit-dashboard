import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "dark" | "light" | "system";
export type ColorVariant = 
  | "zinc" 
  | "rose" 
  | "blue" 
  | "green" 
  | "catppuccin" 
  | "tokyonight"
  | "gruvbox"
  | "nord"
  | "dracula"
  | "onedark"
  | "synthwave";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  defaultColor?: ColorVariant;
  storageKey?: string;
  colorStorageKey?: string;
  avatarStorageKey?: string;
  wallpaperStorageKey?: string;
  wallpaperOpacityKey?: string;
  wallpaperBlurKey?: string;
};

export type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  color: ColorVariant;
  setColor: (color: ColorVariant) => void;
  customAvatar: string | null;
  setCustomAvatar: (avatar: string | null) => void;
  wallpaperUrl: string | null;
  setWallpaperUrl: (url: string | null) => void;
  wallpaperOpacity: number;
  setWallpaperOpacity: (opacity: number) => void;
  wallpaperBlur: number;
  setWallpaperBlur: (blur: number) => void;
};

const initialState: ThemeProviderState = {
  theme: "dark",
  setTheme: () => null,
  color: "zinc",
  setColor: () => null,
  customAvatar: null,
  setCustomAvatar: () => null,
  wallpaperUrl: null,
  setWallpaperUrl: () => null,
  wallpaperOpacity: 0.7,
  setWallpaperOpacity: () => null,
  wallpaperBlur: 4,
  setWallpaperBlur: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "dark",
  defaultColor = "zinc",
  storageKey = "vite-ui-theme",
  colorStorageKey = "vite-ui-color",
  avatarStorageKey = "orbit-custom-avatar",
  wallpaperStorageKey = "orbit-wallpaper-url",
  wallpaperOpacityKey = "orbit-wallpaper-opacity",
  wallpaperBlurKey = "orbit-wallpaper-blur",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  );
  
  const [color, setColor] = useState<ColorVariant>(
    () => (localStorage.getItem(colorStorageKey) as ColorVariant) || defaultColor
  );

  const [customAvatar, setCustomAvatar] = useState<string | null>(
    () => localStorage.getItem(avatarStorageKey) || null
  );

  const [wallpaperUrl, setWallpaperUrl] = useState<string | null>(
    () => localStorage.getItem(wallpaperStorageKey) || null
  );

  const [wallpaperOpacity, setWallpaperOpacity] = useState<number>(() => {
    const saved = localStorage.getItem(wallpaperOpacityKey);
    return saved !== null ? parseFloat(saved) : 0.7;
  });

  const [wallpaperBlur, setWallpaperBlur] = useState<number>(() => {
    const saved = localStorage.getItem(wallpaperBlurKey);
    return saved !== null ? parseFloat(saved) : 4;
  });

  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";

      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [theme]);
  
  useEffect(() => {
    const root = window.document.documentElement;
    Array.from(root.classList)
      .filter((cls) => cls.startsWith("theme-"))
      .forEach((cls) => root.classList.remove(cls));
    root.classList.add(`theme-${color}`);
  }, [color]);

  useEffect(() => {
    const updateFavicon = () => {
      let resolvedTheme: "dark" | "light" = "dark";
      if (theme === "system") {
        resolvedTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      } else {
        resolvedTheme = theme === "light" ? "light" : "dark";
      }

      // Fallback to zinc if custom SVG favicon isn't generated for new colors
      const knownSvgs = ["zinc", "rose", "blue", "green", "catppuccin", "tokyonight"];
      const faviconColor = knownSvgs.includes(color) ? color : "zinc";
      const iconPath = `/icons/orbit/orbit-${faviconColor}-${resolvedTheme}.svg`;
      let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        link.type = "image/svg+xml";
        document.head.appendChild(link);
      }
      link.href = iconPath;
    };

    updateFavicon();

    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => updateFavicon();
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    }
  }, [theme, color]);

  const value: ThemeProviderState = {
    theme,
    setTheme: (t: Theme) => {
      localStorage.setItem(storageKey, t);
      setTheme(t);
    },
    color,
    setColor: (c: ColorVariant) => {
      localStorage.setItem(colorStorageKey, c);
      setColor(c);
    },
    customAvatar,
    setCustomAvatar: (avatar: string | null) => {
      if (avatar) {
        localStorage.setItem(avatarStorageKey, avatar);
      } else {
        localStorage.removeItem(avatarStorageKey);
      }
      setCustomAvatar(avatar);
    },
    wallpaperUrl,
    setWallpaperUrl: (url: string | null) => {
      if (url) {
        localStorage.setItem(wallpaperStorageKey, url);
      } else {
        localStorage.removeItem(wallpaperStorageKey);
      }
      setWallpaperUrl(url);
    },
    wallpaperOpacity,
    setWallpaperOpacity: (opacity: number) => {
      localStorage.setItem(wallpaperOpacityKey, opacity.toString());
      setWallpaperOpacity(opacity);
    },
    wallpaperBlur,
    setWallpaperBlur: (blur: number) => {
      localStorage.setItem(wallpaperBlurKey, blur.toString());
      setWallpaperBlur(blur);
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};
