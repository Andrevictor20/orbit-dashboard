import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Sun,
  CloudSun,
  Cloud,
  CloudRain,
  CloudLightning,
  Snowflake,
  CloudFog,
  Droplets,
  Wind,
  MapPin,
  RefreshCw,
  Edit3,
  Check,
  X,
  Sparkles,
} from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import toast from 'react-hot-toast';

interface WeatherData {
  location_name: string;
  temperature_c: number;
  apparent_temperature_c: number;
  humidity: number;
  wind_speed_kmh: number;
  weather_code: number;
  is_day: boolean;
  condition_text: string;
  updated_at: string;
  aqi?: number;
  aqi_label?: string;
}

export function OverviewWeatherWidget() {
  const { t } = useTranslation();
  const { settings, updateSettings } = useSettings();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditingCity, setIsEditingCity] = useState(false);
  const [cityInput, setCityInput] = useState('');
  const [savedCity, setSavedCity] = useState(() => settings.weather_city || localStorage.getItem('orbit_weather_city') || '');

  const effectiveCity = settings.weather_city || savedCity;

  const loadWeather = useCallback(async (customCity?: string) => {
    try {
      setLoading(true);
      const queryCity = customCity !== undefined ? customCity : effectiveCity;
      let url = '/api/system/weather';

      if (queryCity.trim()) {
        url += `?city=${encodeURIComponent(queryCity.trim())}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setWeather(data);
      }
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  }, [effectiveCity]);

  useEffect(() => {
    loadWeather();
    const interval = setInterval(() => loadWeather(), 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadWeather]);

  const handleSaveCity = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = cityInput.trim();
    setSavedCity(clean);
    if (clean) {
      localStorage.setItem('orbit_weather_city', clean);
      toast.success(t('dashboard.weather_city_changed', { city: clean, defaultValue: `Cidade alterada para ${clean}` }));
    } else {
      localStorage.removeItem('orbit_weather_city');
      toast.success(t('dashboard.weather_auto_location', 'Localização automática ativada'));
    }
    updateSettings({ weather_city: clean }).catch(() => {});
    setIsEditingCity(false);
    loadWeather(clean);
  };

  const getWeatherIcon = (code: number, isDay: boolean) => {
    switch (code) {
      case 0:
        return isDay ? <Sun className="w-5 h-5 text-amber-500 animate-pulse" /> : <Sun className="w-5 h-5 text-indigo-400" />;
      case 1:
      case 2:
        return isDay ? <CloudSun className="w-5 h-5 text-amber-500" /> : <CloudSun className="w-5 h-5 text-indigo-300" />;
      case 3:
        return <Cloud className="w-5 h-5 text-slate-400" />;
      case 45:
      case 48:
        return <CloudFog className="w-5 h-5 text-slate-400" />;
      case 51:
      case 53:
      case 55:
      case 61:
      case 63:
      case 65:
      case 80:
      case 81:
      case 82:
        return <CloudRain className="w-5 h-5 text-sky-400" />;
      case 71:
      case 73:
      case 75:
      case 77:
      case 85:
      case 86:
        return <Snowflake className="w-5 h-5 text-cyan-300" />;
      case 95:
      case 96:
      case 99:
        return <CloudLightning className="w-5 h-5 text-amber-400" />;
      default:
        return <CloudSun className="w-5 h-5 text-amber-500" />;
    }
  };

  const getAqiColor = (aqi: number) => {
    if (aqi <= 50) return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30';
    if (aqi <= 100) return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30';
    if (aqi <= 150) return 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30';
    return 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30';
  };

  if (loading && !weather) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-accent/30 border border-border/50 text-xs text-secondary animate-pulse">
        <RefreshCw className="w-3.5 h-3.5 animate-spin text-orbit-500" />
        <span>{t('dashboard.weather_loading', 'Carregando clima...')}</span>
      </div>
    );
  }

  if (!weather) return null;

  const aqiVal = weather.aqi ?? 23;
  const aqiText = weather.aqi_label || (aqiVal <= 50 ? t('dashboard.aqi_good', 'Boa') : t('dashboard.aqi_moderate', 'Moderada'));

  return (
    <div className="relative flex items-center gap-2.5 sm:gap-3.5 flex-wrap">
      {/* City & Edit Form */}
      {isEditingCity ? (
        <form onSubmit={handleSaveCity} className="flex items-center gap-1">
          <input
            type="text"
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
            placeholder={t('dashboard.weather_city_placeholder', 'Digite a cidade...')}
            className="w-32 sm:w-40 px-2 py-1 text-xs rounded-xl bg-card border border-orbit-500 focus:outline-none text-primary"
            autoFocus
          />
          <button
            type="submit"
            className="p-1 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
            title={t('dashboard.weather_save_city', 'Salvar')}
          >
            <Check className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => setIsEditingCity(false)}
            className="p-1 rounded-lg bg-accent text-secondary hover:text-primary transition-colors"
            title={t('common.cancel', 'Cancelar')}
          >
            <X className="w-3 h-3" />
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => {
            setCityInput(weather.location_name || '');
            setIsEditingCity(true);
          }}
          className="flex items-center gap-1 text-xs font-semibold text-secondary hover:text-primary transition-colors group cursor-pointer"
          title={t('dashboard.change_city', 'Alterar cidade')}
        >
          <MapPin className="w-3.5 h-3.5 text-orbit-500" />
          <span className="truncate max-w-[120px] sm:max-w-[150px]">{weather.location_name}</span>
          <Edit3 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity text-secondary" />
        </button>
      )}

      {/* Temperature & Condition */}
      <div className="flex items-center gap-1.5">
        {getWeatherIcon(weather.weather_code, weather.is_day)}
        <span className="text-sm sm:text-base font-bold font-mono text-primary">
          {Math.round(weather.temperature_c)}°C
        </span>
        <span className="hidden sm:inline-block text-xs text-secondary font-medium">
          {weather.condition_text}
        </span>
      </div>

      {/* Air Quality (AQI) Pill */}
      <div
        className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getAqiColor(aqiVal)}`}
        title={`${t('dashboard.air_quality', 'Qualidade do Ar')}: ${aqiVal} - ${aqiText}`}
      >
        <Sparkles className="w-3 h-3 shrink-0" />
        <span>
          {aqiVal} - {aqiText}
        </span>
      </div>

      {/* Humidity & Wind */}
      <div className="hidden md:flex items-center gap-2 text-[11px] text-secondary font-mono">
        <span className="flex items-center gap-1" title="Umidade">
          <Droplets className="w-3 h-3 text-sky-400" />
          {weather.humidity}%
        </span>
        <span className="flex items-center gap-1" title="Vento">
          <Wind className="w-3 h-3 text-cyan-400" />
          {Math.round(weather.wind_speed_kmh)} km/h
        </span>
      </div>
    </div>
  );
}
