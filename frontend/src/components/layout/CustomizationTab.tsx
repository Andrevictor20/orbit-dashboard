import React, { useState, useRef } from 'react';
import { Upload, Trash2, Link as LinkIcon, Image, Sliders, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useTheme } from '../../contexts/ThemeContext';
import { UserAvatar } from '../ui/UserAvatar';

const WALLPAPER_PRESETS = [
  {
    name: 'Nebulosa Espacial',
    url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?q=80&w=1920&auto=format&fit=crop',
    thumb: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?q=80&w=240&auto=format&fit=crop'
  },
  {
    name: 'Montanha Cósmica',
    url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1920&auto=format&fit=crop',
    thumb: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=240&auto=format&fit=crop'
  },
  {
    name: 'Linhas Cyberpunk',
    url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=1920&auto=format&fit=crop',
    thumb: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=240&auto=format&fit=crop'
  },
  {
    name: 'Gradiente Minimalista',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1920&auto=format&fit=crop',
    thumb: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=240&auto=format&fit=crop'
  }
];

export function CustomizationTab() {
  const { t } = useTranslation();
  const {
    customAvatar,
    setCustomAvatar,
    wallpaperUrl,
    setWallpaperUrl,
    wallpaperOpacity,
    setWallpaperOpacity,
    wallpaperBlur,
    setWallpaperBlur,
  } = useTheme();

  const [avatarUrlInput, setAvatarUrlInput] = useState('');
  const [wallpaperUrlInput, setWallpaperUrlInput] = useState('');
  const [showAvatarUrlInput, setShowAvatarUrlInput] = useState(false);
  const [showWallpaperUrlInput, setShowWallpaperUrlInput] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const wallpaperInputRef = useRef<HTMLInputElement>(null);

  // Compress and set avatar image to 256x256 max
  const handleAvatarFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = document.createElement('img');
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = Math.min(256, Math.max(img.width, img.height));
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Center crop
          const minDim = Math.min(img.width, img.height);
          const sx = (img.width - minDim) / 2;
          const sy = (img.height - minDim) / 2;
          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
          const dataUrl = canvas.toDataURL('image/webp', 0.85);
          setCustomAvatar(dataUrl);
          toast.success(t('customization.avatar_updated', 'Ícone de perfil atualizado com sucesso!'));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Compress and set wallpaper image to 1920x1080 max
  const handleWallpaperFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = document.createElement('img');
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1920;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/webp', 0.8);
          setWallpaperUrl(dataUrl);
          toast.success(t('customization.wallpaper_updated', 'Plano de fundo atualizado com sucesso!'));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleApplyAvatarUrl = () => {
    if (!avatarUrlInput.trim()) return;
    setCustomAvatar(avatarUrlInput.trim());
    setAvatarUrlInput('');
    setShowAvatarUrlInput(false);
    toast.success(t('customization.avatar_updated', 'Ícone de perfil atualizado!'));
  };

  const handleApplyWallpaperUrl = () => {
    if (!wallpaperUrlInput.trim()) return;
    setWallpaperUrl(wallpaperUrlInput.trim());
    setWallpaperUrlInput('');
    setShowWallpaperUrlInput(false);
    toast.success(t('customization.wallpaper_updated', 'Plano de fundo atualizado!'));
  };

  return (
    <div className="space-y-6 max-h-[65vh] overflow-y-auto pr-1">
      {/* 1. Profile Avatar Customization */}
      <div className="space-y-3 p-4 rounded-2xl bg-card/60 border border-border/70">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-secondary">
            {t('customization.avatar_title', 'Ícone do Usuário / Avatar')}
          </span>
          {customAvatar && (
            <button
              onClick={() => {
                setCustomAvatar(null);
                toast.success(t('customization.avatar_reset', 'Ícone restaurado para o padrão!'));
              }}
              className="text-xs text-rose-500 hover:text-rose-400 flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t('common.reset', 'Restaurar Padrão')}</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="p-1 rounded-2xl bg-card border border-border/80 shadow-md flex items-center justify-center shrink-0">
            <UserAvatar size={64} showGlow className="rounded-xl" />
          </div>

          <div className="flex-1 space-y-2">
            <p className="text-xs text-secondary leading-relaxed">
              {t('customization.avatar_desc', 'Personalize o ícone do seu perfil com uma imagem local ou URL.')}
            </p>

            <div className="flex flex-wrap gap-2">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarFileUpload}
                className="hidden"
                data-testid="avatar-file-input"
              />
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="px-3 py-1.5 rounded-xl bg-orbit-500/15 hover:bg-orbit-500/25 border border-orbit-500/30 text-orbit-400 text-xs font-medium flex items-center gap-1.5 transition-all active:scale-95"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{t('customization.upload_image', 'Carregar Imagem')}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAvatarUrlInput(!showAvatarUrlInput)}
                className="px-3 py-1.5 rounded-xl bg-card hover:bg-accent/70 border border-border/80 text-primary text-xs font-medium flex items-center gap-1.5 transition-all active:scale-95"
              >
                <LinkIcon className="w-3.5 h-3.5 text-secondary" />
                <span>URL</span>
              </button>
            </div>
          </div>
        </div>

        {showAvatarUrlInput && (
          <div className="flex gap-2 pt-1 animate-in fade-in duration-200">
            <input
              type="url"
              placeholder="https://exemplo.com/avatar.jpg"
              value={avatarUrlInput}
              onChange={(e) => setAvatarUrlInput(e.target.value)}
              className="flex-1 bg-background border border-border rounded-xl py-1.5 px-3 text-xs text-primary focus:outline-none focus:ring-2 focus:ring-orbit-500/30 focus:border-orbit-500"
            />
            <button
              type="button"
              onClick={handleApplyAvatarUrl}
              className="px-3 py-1.5 rounded-xl bg-orbit-500 hover:bg-orbit-600 text-white text-xs font-medium transition-all"
            >
              OK
            </button>
          </div>
        )}
      </div>

      {/* 2. Wallpaper Customization */}
      <div className="space-y-4 p-4 rounded-2xl bg-card/60 border border-border/70">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image className="w-4 h-4 text-orbit-500" />
            <span className="text-xs font-semibold uppercase tracking-wider text-secondary">
              {t('customization.wallpaper_title', 'Plano de Fundo (Wallpaper)')}
            </span>
          </div>
          {wallpaperUrl && (
            <button
              onClick={() => {
                setWallpaperUrl(null);
                toast.success(t('customization.wallpaper_removed', 'Plano de fundo removido!'));
              }}
              className="text-xs text-rose-500 hover:text-rose-400 flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t('common.remove', 'Remover')}</span>
            </button>
          )}
        </div>

        <p className="text-xs text-secondary leading-relaxed">
          {t('customization.wallpaper_desc', 'Adicione uma imagem de fundo com efeito de vidro translúcido adaptativo.')}
        </p>

        {/* Wallpaper actions */}
        <div className="flex flex-wrap gap-2">
          <input
            ref={wallpaperInputRef}
            type="file"
            accept="image/*"
            onChange={handleWallpaperFileUpload}
            className="hidden"
            data-testid="wallpaper-file-input"
          />
          <button
            type="button"
            onClick={() => wallpaperInputRef.current?.click()}
            className="px-3 py-1.5 rounded-xl bg-orbit-500/15 hover:bg-orbit-500/25 border border-orbit-500/30 text-orbit-400 text-xs font-medium flex items-center gap-1.5 transition-all active:scale-95"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{t('customization.upload_wallpaper', 'Carregar Foto')}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowWallpaperUrlInput(!showWallpaperUrlInput)}
            className="px-3 py-1.5 rounded-xl bg-card hover:bg-accent/70 border border-border/80 text-primary text-xs font-medium flex items-center gap-1.5 transition-all active:scale-95"
          >
            <LinkIcon className="w-3.5 h-3.5 text-secondary" />
            <span>URL</span>
          </button>
        </div>

        {showWallpaperUrlInput && (
          <div className="flex gap-2 animate-in fade-in duration-200">
            <input
              type="url"
              placeholder="https://exemplo.com/fundo.jpg"
              value={wallpaperUrlInput}
              onChange={(e) => setWallpaperUrlInput(e.target.value)}
              className="flex-1 bg-background border border-border rounded-xl py-1.5 px-3 text-xs text-primary focus:outline-none focus:ring-2 focus:ring-orbit-500/30 focus:border-orbit-500"
            />
            <button
              type="button"
              onClick={handleApplyWallpaperUrl}
              className="px-3 py-1.5 rounded-xl bg-orbit-500 hover:bg-orbit-600 text-white text-xs font-medium transition-all"
            >
              OK
            </button>
          </div>
        )}

        {/* Wallpaper Presets */}
        <div>
          <span className="text-[11px] font-medium text-secondary mb-2 block">
            {t('customization.presets', 'Galeria de Temas')}
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {WALLPAPER_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => {
                  setWallpaperUrl(preset.url);
                  toast.success(t('customization.wallpaper_updated', 'Plano de fundo atualizado!'));
                }}
                className={`group relative aspect-video rounded-xl overflow-hidden border transition-all ${
                  wallpaperUrl === preset.url
                    ? 'border-orbit-500 ring-2 ring-orbit-500/30 shadow-md'
                    : 'border-border/70 hover:border-orbit-500/50'
                }`}
              >
                <img
                  src={preset.thumb}
                  alt={preset.name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-1.5">
                  <span className="text-[10px] text-white font-medium truncate drop-shadow">
                    {preset.name}
                  </span>
                </div>
                {wallpaperUrl === preset.url && (
                  <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-orbit-500 text-white flex items-center justify-center">
                    <Check className="w-2.5 h-2.5" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Sliders: Dimmer Opacity and Blur */}
        {wallpaperUrl && (
          <div className="space-y-3 pt-2 border-t border-border/60">
            <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
              <Sliders className="w-3.5 h-3.5 text-orbit-500" />
              <span>{t('customization.adjustments', 'Ajustes de Legibilidade')}</span>
            </div>

            <div className="space-y-3">
              {/* Opacity Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-secondary">{t('customization.dimmer', 'Opacidade do Véu')}</span>
                  <span className="font-mono text-primary">{Math.round(wallpaperOpacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="0.95"
                  step="0.05"
                  value={wallpaperOpacity}
                  onChange={(e) => setWallpaperOpacity(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-orbit-500"
                />
                <p className="text-[10px] text-secondary">
                  {t('customization.dimmer_hint', 'Escurece o fundo para garantir contraste e legibilidade com os cards.')}
                </p>
              </div>

              {/* Blur Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-secondary">{t('customization.blur', 'Desfoque de Fundo')}</span>
                  <span className="font-mono text-primary">{wallpaperBlur}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  step="1"
                  value={wallpaperBlur}
                  onChange={(e) => setWallpaperBlur(parseInt(e.target.value, 10))}
                  className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-orbit-500"
                />
                <p className="text-[10px] text-secondary">
                  {t('customization.blur_hint', 'Suaviza detalhes para destacar o conteúdo em primeiro plano.')}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
