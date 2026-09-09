import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ThemeProvider, useTheme } from '../../contexts/ThemeContext';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { MobilePreferencesDropdown, COLOR_THEMES_LIST } from '../../components/layout/MobilePreferencesDropdown';
import { ProfileModal } from '../../components/layout/ProfileModal';

// Helper component to test ThemeContext values
function ThemeConsumer() {
  const { 
    theme, 
    color, 
    setColor, 
    customAvatar, 
    setCustomAvatar,
    wallpaperUrl,
    setWallpaperUrl,
    wallpaperOpacity,
    setWallpaperOpacity,
    wallpaperBlur,
    setWallpaperBlur
  } = useTheme();

  return (
    <div>
      <span data-testid="current-theme">{theme}</span>
      <span data-testid="current-color">{color}</span>
      <span data-testid="current-avatar">{customAvatar || 'none'}</span>
      <span data-testid="current-wallpaper">{wallpaperUrl || 'none'}</span>
      <span data-testid="current-opacity">{wallpaperOpacity}</span>
      <span data-testid="current-blur">{wallpaperBlur}</span>

      <button onClick={() => setColor('gruvbox')}>Set Gruvbox</button>
      <button onClick={() => setColor('nord')}>Set Nord</button>
      <button onClick={() => setColor('dracula')}>Set Dracula</button>
      <button onClick={() => setColor('onedark')}>Set One Dark</button>
      <button onClick={() => setColor('synthwave')}>Set Synthwave</button>

      <button onClick={() => setCustomAvatar('data:image/webp;base64,sample')}>Set Avatar</button>
      <button onClick={() => setCustomAvatar(null)}>Clear Avatar</button>

      <button onClick={() => setWallpaperUrl('https://example.com/bg.jpg')}>Set Wallpaper</button>
      <button onClick={() => setWallpaperUrl(null)}>Clear Wallpaper</button>
      <button onClick={() => setWallpaperOpacity(0.85)}>Set Opacity</button>
      <button onClick={() => setWallpaperBlur(12)}>Set Blur</button>
    </div>
  );
}

describe('Visual Customization & Developer Themes', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
  });

  it('supports developer themes: gruvbox, nord, dracula, onedark, synthwave', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    // Gruvbox
    fireEvent.click(screen.getByText('Set Gruvbox'));
    expect(screen.getByTestId('current-color').textContent).toBe('gruvbox');
    expect(document.documentElement.classList.contains('theme-gruvbox')).toBe(true);

    // Nord
    fireEvent.click(screen.getByText('Set Nord'));
    expect(screen.getByTestId('current-color').textContent).toBe('nord');
    expect(document.documentElement.classList.contains('theme-nord')).toBe(true);
    expect(document.documentElement.classList.contains('theme-gruvbox')).toBe(false);

    // Dracula
    fireEvent.click(screen.getByText('Set Dracula'));
    expect(screen.getByTestId('current-color').textContent).toBe('dracula');
    expect(document.documentElement.classList.contains('theme-dracula')).toBe(true);

    // One Dark
    fireEvent.click(screen.getByText('Set One Dark'));
    expect(screen.getByTestId('current-color').textContent).toBe('onedark');
    expect(document.documentElement.classList.contains('theme-onedark')).toBe(true);

    // Synthwave
    fireEvent.click(screen.getByText('Set Synthwave'));
    expect(screen.getByTestId('current-color').textContent).toBe('synthwave');
    expect(document.documentElement.classList.contains('theme-synthwave')).toBe(true);
  });

  it('manages custom avatar and persists in localStorage', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('current-avatar').textContent).toBe('none');

    fireEvent.click(screen.getByText('Set Avatar'));
    expect(screen.getByTestId('current-avatar').textContent).toBe('data:image/webp;base64,sample');
    expect(localStorage.getItem('orbit-custom-avatar')).toBe('data:image/webp;base64,sample');

    fireEvent.click(screen.getByText('Clear Avatar'));
    expect(screen.getByTestId('current-avatar').textContent).toBe('none');
    expect(localStorage.getItem('orbit-custom-avatar')).toBeNull();
  });

  it('manages custom wallpaper, opacity, blur and persists in localStorage', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('current-wallpaper').textContent).toBe('none');

    fireEvent.click(screen.getByText('Set Wallpaper'));
    expect(screen.getByTestId('current-wallpaper').textContent).toBe('https://example.com/bg.jpg');
    expect(localStorage.getItem('orbit-wallpaper-url')).toBe('https://example.com/bg.jpg');

    fireEvent.click(screen.getByText('Set Opacity'));
    expect(screen.getByTestId('current-opacity').textContent).toBe('0.85');
    expect(localStorage.getItem('orbit-wallpaper-opacity')).toBe('0.85');

    fireEvent.click(screen.getByText('Set Blur'));
    expect(screen.getByTestId('current-blur').textContent).toBe('12');
    expect(localStorage.getItem('orbit-wallpaper-blur')).toBe('12');

    fireEvent.click(screen.getByText('Clear Wallpaper'));
    expect(screen.getByTestId('current-wallpaper').textContent).toBe('none');
    expect(localStorage.getItem('orbit-wallpaper-url')).toBeNull();
  });

  it('renders UserAvatar with default OrbitLogo and switches to custom image', () => {
    const { unmount } = render(
      <ThemeProvider>
        <UserAvatar size={40} alt="Test User" />
      </ThemeProvider>
    );

    // Default renders SVG
    expect(document.querySelector('svg')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();

    unmount();

    // Now set custom avatar in localStorage
    localStorage.setItem('orbit-custom-avatar', 'https://example.com/my-avatar.png');

    render(
      <ThemeProvider>
        <UserAvatar size={40} alt="Test User" />
      </ThemeProvider>
    );

    const img = screen.getByRole('img');
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe('https://example.com/my-avatar.png');
  });

  it('renders MobilePreferencesDropdown with 11 themes and triggers onColorChange', () => {
    const onColorChange = vi.fn();
    render(
      <MobilePreferencesDropdown
        color="zinc"
        onColorChange={onColorChange}
        currentLang="pt"
        onLangChange={vi.fn()}
        languages={[{ code: 'pt', flag: '🇧🇷', nativeName: 'Português' }]}
      />
    );

    // Open dropdown
    const toggleBtn = screen.getByLabelText('Preferências (Tema e Idioma)');
    fireEvent.click(toggleBtn);

    // Verify all 11 themes in the list
    expect(COLOR_THEMES_LIST.length).toBe(11);
    expect(screen.getByText('Gruvbox')).toBeTruthy();
    expect(screen.getByText('Nord')).toBeTruthy();
    expect(screen.getByText('Dracula')).toBeTruthy();
    expect(screen.getByText('One Dark')).toBeTruthy();
    expect(screen.getByText('Synthwave')).toBeTruthy();

    // Click Gruvbox
    fireEvent.click(screen.getByText('Gruvbox'));
    expect(onColorChange).toHaveBeenCalledWith('gruvbox');
  });

  it('renders ProfileModal with Account and Customization tabs', () => {
    render(
      <ThemeProvider>
        <ProfileModal isOpen={true} onClose={vi.fn()} />
      </ThemeProvider>
    );

    expect(screen.getByText('Conta & Segurança')).toBeTruthy();
    expect(screen.getByText('Aparência & Fundo')).toBeTruthy();

    // Initially in account tab
    expect(screen.getByText('Senha Atual')).toBeTruthy();

    // Switch to customization tab
    fireEvent.click(screen.getByText('Aparência & Fundo'));
    expect(screen.getByText(/Ícone do Usuário/i)).toBeTruthy();
    expect(screen.getByText(/Plano de Fundo/i)).toBeTruthy();
    expect(screen.getByText('Nebulosa Espacial')).toBeTruthy();
  });
});
