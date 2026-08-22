import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light" | "system";
type ColorVariant = "zinc" | "rose" | "blue" | "green" | "catppuccin" | "tokyonight";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  defaultColor?: ColorVariant;
  storageKey?: string;
  colorStorageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  color: ColorVariant;
  setColor: (color: ColorVariant) => void;
};

const initialState: ThemeProviderState = {
  theme: "dark",
  setTheme: () => null,
  color: "zinc",
  setColor: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "dark",
  defaultColor = "zinc",
  storageKey = "vite-ui-theme",
  colorStorageKey = "vite-ui-color",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  );
  
  const [color, setColor] = useState<ColorVariant>(
    () => (localStorage.getItem(colorStorageKey) as ColorVariant) || defaultColor
  );

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
    root.classList.remove("theme-zinc", "theme-rose", "theme-blue", "theme-green", "theme-catppuccin", "theme-tokyonight");
    root.classList.add(`theme-${color}`);
  }, [color]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme);
      setTheme(theme);
    },
    color,
    setColor: (color: ColorVariant) => {
      localStorage.setItem(colorStorageKey, color);
      setColor(color);
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
