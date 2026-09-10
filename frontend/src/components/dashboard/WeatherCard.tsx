import { useState, useEffect, useCallback } from 'react';
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
  X, 
  Check 
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
}

export function WeatherCard() {
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
    // Auto-refresh weather every 30 minutes
    const interval = setInterval(() => loadWeather(), 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadWeather]);

  useEffect(() => {
    if (settings.weather_city !== undefined) {
      setSavedCity(settings.weather_city);
    }
  }, [settings.weather_city]);

  const handleSaveCity = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = cityInput.trim();
    setSavedCity(clean);
    if (clean) {
      localStorage.setItem('orbit_weather_city', clean);
      toast.success(`Cidade alterada para ${clean}`);
    } else {
      localStorage.removeItem('orbit_weather_city');
      toast.success('Localização automática ativada');
    }
    updateSettings({ weather_city: clean }).catch(() => {});
    setIsEditingCity(false);
    loadWeather(clean);
  };

  const getWeatherIcon = (code: number, isDay: boolean) => {
    switch (code) {
      case 0:
        return isDay ? <Sun className="w-8 h-8 text-amber-500 animate-pulse" /> : <Sun className="w-8 h-8 text-indigo-400" />;
      case 1:
      case 2:
        return <CloudSun className="w-8 h-8 text-amber-500" />;
      case 3:
        return <Cloud className="w-8 h-8 text-secondary" />;
      case 45:
      case 48:
        return <CloudFog className="w-8 h-8 text-secondary" />;
      case 51:
      case 53:
      case 55:
      case 61:
      case 63:
      case 65:
      case 80:
      case 81:
      case 82:
        return <CloudRain className="w-8 h-8 text-blue-500" />;
      case 71:
      case 73:
      case 75:
      case 77:
      case 85:
      case 86:
        return <Snowflake className="w-8 h-8 text-cyan-400" />;
      case 95:
      case 96:
      case 99:
        return <CloudLightning className="w-8 h-8 text-amber-400 animate-bounce" />;
      default:
        return <CloudSun className="w-8 h-8 text-orbit-500" />;
    }
  };

  if (loading && !weather) {
    return (
      <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-5 flex items-center justify-center min-h-[140px]">
        <div className="flex items-center gap-2 text-xs text-secondary">
          <RefreshCw className="w-4 h-4 animate-spin text-orbit-500" />
          <span>Carregando previsão do tempo...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card/60 backdrop-blur-3xl saturate-[190%] hover:bg-accent/70 border border-border/80 hover:border-orbit-500/40 rounded-2xl p-4 sm:p-5 transition-all duration-200 shadow-sm hover:shadow-md h-full min-h-[180px] flex flex-col justify-between relative overflow-hidden">
      {/* Top row: City & Actions */}
      <div className="flex items-center justify-between gap-2 mb-2">
        {isEditingCity ? (
          <form onSubmit={handleSaveCity} className="flex items-center gap-1.5 flex-1 max-w-xs">
            <input
              type="text"
              placeholder="Digite o nome da cidade..."
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
              autoFocus
              className="w-full bg-accent/60 border border-border text-primary rounded-xl px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orbit-500"
            />
            <button
              type="submit"
              className="p-1 bg-orbit-500 text-white rounded-lg hover:bg-orbit-600 transition-colors"
              title="Salvar cidade"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setIsEditingCity(false)}
              className="p-1 text-secondary hover:text-primary rounded-lg hover:bg-accent transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-1.5 group cursor-pointer" onClick={() => { setCityInput(effectiveCity); setIsEditingCity(true); }}>
            <MapPin className="w-3.5 h-3.5 text-orbit-500 shrink-0" />
            <span className="text-xs font-semibold text-primary group-hover:text-orbit-500 transition-colors truncate max-w-[140px]">
              {weather?.location_name || 'Homelab Local'}
            </span>
            <Edit3 className="w-3 h-3 text-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        )}

        <button
          onClick={() => loadWeather()}
          disabled={loading}
          className="p-1.5 text-secondary hover:text-primary rounded-lg hover:bg-accent transition-colors"
          title="Atualizar clima"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-orbit-500' : ''}`} />
        </button>
      </div>

      {/* Main weather info */}
      <div className="flex items-center justify-between gap-3 my-auto">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-accent/60 rounded-xl border border-border/60">
            {getWeatherIcon(weather?.weather_code || 0, weather?.is_day ?? true)}
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-primary tracking-tight">
              {weather ? Math.round(weather.temperature_c) : '--'}°C
            </div>
            <div className="text-xs text-secondary font-medium line-clamp-1">
              {weather?.condition_text || 'Parcialmente Nublado'}
            </div>
            {weather?.apparent_temperature_c !== undefined && (
              <div className="text-[10px] text-secondary/80 font-mono mt-0.5">
                Sensação {Math.round(weather.apparent_temperature_c)}°C
              </div>
            )}
          </div>
        </div>

        {/* Details: Humidity & Wind */}
        <div className="text-right space-y-1.5 text-xs">
          <div className="flex items-center justify-end gap-1.5 text-secondary font-mono">
            <Droplets className="w-3.5 h-3.5 text-blue-500" />
            <span>{weather?.humidity ?? '--'}%</span>
          </div>
          <div className="flex items-center justify-end gap-1.5 text-secondary font-mono">
            <Wind className="w-3.5 h-3.5 text-emerald-500" />
            <span>{weather ? Math.round(weather.wind_speed_kmh) : '--'} km/h</span>
          </div>
        </div>
      </div>
    </div>
  );
}
