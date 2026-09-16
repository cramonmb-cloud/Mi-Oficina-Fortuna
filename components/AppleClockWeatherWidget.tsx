import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Clock, 
  MapPin, 
  Sun, 
  Moon, 
  Cloud, 
  CloudRain, 
  CloudLightning, 
  CloudFog, 
  Wind, 
  Droplets, 
  Thermometer, 
  RefreshCw,
  Laptop
} from 'lucide-react';

export interface WeatherLocation {
  id: string;
  name: string;
  shortName: string;
  state: string;
  latitude: number;
  longitude: number;
}

export const WEATHER_LOCATIONS: WeatherLocation[] = [
  {
    id: 'guzman',
    name: 'Ciudad Guzmán',
    shortName: 'Cd. Guzmán',
    state: 'Jalisco, México',
    latitude: 19.7047,
    longitude: -103.4617
  },
  {
    id: 'autlan',
    name: 'Autlán de Navarro',
    shortName: 'Autlán',
    state: 'Jalisco, México',
    latitude: 19.7725,
    longitude: -104.3644
  }
];

interface WeatherData {
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  windSpeed: number;
  isDay: boolean;
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  updatedAt: string;
}

// Mapeo oficial de códigos meteorológicos WMO
const getWeatherDetails = (code: number, isDay: boolean) => {
  switch (code) {
    case 0:
      return {
        label: isDay ? 'Cielo Despejado' : 'Noche Despejada',
        icon: isDay ? Sun : Moon,
        color: isDay ? 'text-amber-400' : 'text-indigo-200'
      };
    case 1:
    case 2:
      return {
        label: isDay ? 'Mayormente Soleado' : 'Parcialmente Nublado',
        icon: isDay ? Cloud : Cloud,
        color: isDay ? 'text-amber-300' : 'text-slate-300'
      };
    case 3:
      return {
        label: 'Nublado',
        icon: Cloud,
        color: 'text-slate-300'
      };
    case 45:
    case 48:
      return {
        label: 'Niebla / Neblina',
        icon: CloudFog,
        color: 'text-slate-300'
      };
    case 51:
    case 53:
    case 55:
      return {
        label: 'Llovizna Ligera',
        icon: CloudRain,
        color: 'text-sky-300'
      };
    case 61:
    case 63:
    case 65:
      return {
        label: 'Lluvia',
        icon: CloudRain,
        color: 'text-sky-400'
      };
    case 80:
    case 81:
    case 82:
      return {
        label: 'Chubascos',
        icon: CloudRain,
        color: 'text-sky-300'
      };
    case 95:
    case 96:
    case 99:
      return {
        label: 'Tormenta Eléctrica',
        icon: CloudLightning,
        color: 'text-amber-400'
      };
    default:
      return {
        label: isDay ? 'Agradable' : 'Templado',
        icon: isDay ? Sun : Moon,
        color: 'text-amber-300'
      };
  }
};

export const AppleClockWeatherWidget: React.FC = () => {
  // ==========================================
  // 1. RELOJ DIGITAL APPLE EN TIEMPO REAL
  // ==========================================
  const [now, setNow] = useState<Date>(new Date());
  const [use24Hour, setUse24Hour] = useState<boolean>(() => {
    return localStorage.getItem('apple_clock_24h') === 'true';
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const toggle24Hour = () => {
    setUse24Hour(prev => {
      const next = !prev;
      localStorage.setItem('apple_clock_24h', String(next));
      return next;
    });
  };

  // Formateo de hora estilo Apple
  const hours = now.getHours();
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');

  let displayHours = hours;
  let ampm = '';

  if (!use24Hour) {
    ampm = hours >= 12 ? 'PM' : 'AM';
    displayHours = hours % 12 || 12;
  }
  const formattedHours = use24Hour ? hours.toString().padStart(2, '0') : displayHours.toString();

  // Formateo de fecha
  const dayName = now.toLocaleDateString('es-MX', { weekday: 'long' });
  const dayNumber = now.getDate();
  const monthName = now.toLocaleDateString('es-MX', { month: 'long' });
  const yearNumber = now.getFullYear();

  // ==========================================
  // 2. CLIMA EN VIVO: CD. GUZMÁN / AUTLÁN
  // ==========================================
  const [selectedLocationId, setSelectedLocationId] = useState<string>(() => {
    return localStorage.getItem('dashboard_weather_location') || 'guzman';
  });

  const currentLocation = useMemo(() => {
    return WEATHER_LOCATIONS.find(loc => loc.id === selectedLocationId) || WEATHER_LOCATIONS[0];
  }, [selectedLocationId]);

  const [weather, setWeather] = useState<WeatherData | null>(() => {
    try {
      const initialLocId = localStorage.getItem('dashboard_weather_location') || 'guzman';
      const cached = localStorage.getItem(`weather_cache_${initialLocId}`) || localStorage.getItem('guzman_weather_cache');
      if (cached) return JSON.parse(cached);
    } catch {
      // ignore
    }
    return null;
  });

  const [isLoadingWeather, setIsLoadingWeather] = useState<boolean>(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  const fetchWeather = useCallback(async (loc: WeatherLocation = currentLocation) => {
    setIsLoadingWeather(true);
    setWeatherError(null);
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('No se pudo obtener el pronóstico');
      const data = await res.json();

      const newWeather: WeatherData = {
        temperature: Math.round(data.current?.temperature_2m ?? 0),
        apparentTemperature: Math.round(data.current?.apparent_temperature ?? 0),
        humidity: Math.round(data.current?.relative_humidity_2m ?? 0),
        windSpeed: Math.round(data.current?.wind_speed_10m ?? 0),
        isDay: data.current?.is_day === 1,
        weatherCode: data.current?.weather_code ?? 0,
        tempMax: Math.round(data.daily?.temperature_2m_max?.[0] ?? 0),
        tempMin: Math.round(data.daily?.temperature_2m_min?.[0] ?? 0),
        updatedAt: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
      };

      setWeather(newWeather);
      localStorage.setItem(`weather_cache_${loc.id}`, JSON.stringify(newWeather));
    } catch (err: any) {
      console.error(`Error fetching ${loc.name} weather:`, err);
      setWeatherError('Error al actualizar');
    } finally {
      setIsLoadingWeather(false);
    }
  }, [currentLocation]);

  // Al cambiar de ubicación, cargar inmediatamente caché de esa ubicación y refrescar
  const handleSelectLocation = (newLocId: string) => {
    if (newLocId === selectedLocationId) return;
    setSelectedLocationId(newLocId);
    localStorage.setItem('dashboard_weather_location', newLocId);

    const targetLoc = WEATHER_LOCATIONS.find(l => l.id === newLocId) || WEATHER_LOCATIONS[0];
    try {
      const cached = localStorage.getItem(`weather_cache_${newLocId}`);
      if (cached) {
        setWeather(JSON.parse(cached));
      }
    } catch {
      // ignore
    }

    fetchWeather(targetLoc);
  };

  useEffect(() => {
    fetchWeather();
    // Actualización periódica cada 15 minutos
    const interval = setInterval(() => fetchWeather(), 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchWeather]);

  const weatherDetails = weather 
    ? getWeatherDetails(weather.weatherCode, weather.isDay)
    : { label: 'Cargando...', icon: Sun, color: 'text-amber-400' };

  const WeatherIconComponent = weatherDetails.icon;

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
      
      {/* ======================================================== */}
      {/* CARD 1: RELOJ DIGITAL APPLE EN TIEMPO REAL (7 COLS)       */}
      {/* ======================================================== */}
      <div className="md:col-span-7 relative overflow-hidden rounded-3xl bg-slate-900 text-white p-5 sm:p-6 shadow-xl border border-slate-800/80 flex flex-col justify-between group">
        
        {/* Efecto Glassmorphism / Gradiente Apple */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/15 transition-all"></div>
        <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Barra superior de la tarjeta */}
        <div className="flex items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400">
              Tiempo Real
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggle24Hour}
              className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/80 transition-colors cursor-pointer"
              title="Cambiar entre formato de 12 horas y 24 horas"
            >
              {use24Hour ? 'Formato 24h' : 'Formato 12h'}
            </button>
            <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
              <Laptop className="w-3.5 h-3.5 text-slate-400" />
              <span>Tu Equipo</span>
            </div>
          </div>
        </div>

        {/* Centro: Display del Reloj Digital Apple */}
        <div className="my-3 sm:my-4 relative z-10">
          <div className="flex items-baseline gap-1.5 sm:gap-2">
            {/* Horas y Minutos */}
            <span className="font-mono text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white drop-shadow-sm select-none">
              {formattedHours}:{minutes}
            </span>
            
            {/* Segundos y AM/PM */}
            <div className="flex flex-col items-start leading-none gap-1 font-mono">
              <span className="text-emerald-400 text-lg sm:text-2xl font-bold tracking-wider opacity-90 select-none">
                :{seconds}
              </span>
              {!use24Hour && (
                <span className="text-[10px] sm:text-xs font-black px-1.5 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-500/40 text-emerald-300">
                  {ampm}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Pie: Fecha Completa Estilo Apple Calendar */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-800/80 relative z-10">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-bold capitalize text-slate-200">
              {dayName}
            </span>
            <span className="w-1 h-1 rounded-full bg-slate-600"></span>
            <span className="text-xs sm:text-sm text-slate-400">
              {dayNumber} de {monthName}, {yearNumber}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1 text-[10px] text-slate-500 font-medium">
            <Clock className="w-3 h-3 text-slate-500" />
            <span>Sincronizado</span>
          </div>
        </div>

      </div>

      {/* ======================================================== */}
      {/* CARD 2: CLIMA EN VIVO - SELECTOR CD. GUZMÁN / AUTLÁN      */}
      {/* ======================================================== */}
      <div className="md:col-span-5 relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 text-white p-5 sm:p-6 shadow-xl border border-slate-800/80 flex flex-col justify-between group">
        
        {/* Glow dinámico según día / noche */}
        <div className={`absolute -top-20 -right-20 w-52 h-52 rounded-full blur-3xl pointer-events-none transition-all ${
          weather?.isDay ? 'bg-amber-500/15 group-hover:bg-amber-500/20' : 'bg-indigo-500/15 group-hover:bg-indigo-500/20'
        }`}></div>

        {/* Header de Ubicación y Selector de Financiera / Municipio */}
        <div className="flex items-center justify-between gap-2 relative z-10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-white/10 backdrop-blur-xs text-white">
              <MapPin className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div>
              <h4 className="text-xs font-black text-white tracking-wide leading-tight">
                {currentLocation.name}
              </h4>
              <p className="text-[10px] font-bold text-slate-400">
                {currentLocation.state}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Selector Segmentado Estilo Apple */}
            <div className="flex items-center bg-white/10 p-0.5 rounded-xl backdrop-blur-md border border-white/10">
              {WEATHER_LOCATIONS.map(loc => {
                const isActive = loc.id === selectedLocationId;
                return (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => handleSelectLocation(loc.id)}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                      isActive 
                        ? 'bg-white text-slate-900 shadow-xs font-black' 
                        : 'text-slate-300 hover:text-white'
                    }`}
                    title={`Ver clima de ${loc.name}, Jalisco`}
                  >
                    {loc.shortName}
                  </button>
                );
              })}
            </div>

            {/* Botón de Refresco Manual */}
            <button
              onClick={() => fetchWeather(currentLocation)}
              disabled={isLoadingWeather}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all disabled:opacity-50 cursor-pointer"
              title="Actualizar clima ahora"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingWeather ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Centro: Temperatura y Estado */}
        <div className="my-3 sm:my-4 flex items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-start">
              <span className="font-mono text-4xl sm:text-5xl font-black text-white tracking-tighter">
                {weather ? `${weather.temperature}°` : '--°'}
              </span>
              <span className="text-xs font-bold text-slate-400 ml-1 mt-1">C</span>
            </div>
            <p className="text-xs font-bold text-slate-300 flex items-center gap-1 mt-0.5">
              <span>{weather ? weatherDetails.label : (weatherError || 'Consultando...')}</span>
            </p>
          </div>

          <div className="p-3 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 flex items-center justify-center shrink-0">
            <WeatherIconComponent className={`w-8 h-8 sm:w-10 sm:h-10 ${weatherDetails.color} animate-pulse`} />
          </div>
        </div>

        {/* Pie: Métricas Climatológicas (Sensación, Humedad, Viento) */}
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-800/80 text-[10px] text-slate-400 relative z-10">
          <div className="flex flex-col">
            <span className="text-slate-500 font-bold uppercase text-[9px] flex items-center gap-1">
              <Thermometer className="w-2.5 h-2.5 text-amber-400" />
              Sensación
            </span>
            <span className="font-bold text-slate-200 mt-0.5">
              {weather ? `${weather.apparentTemperature}°C` : '--'}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-slate-500 font-bold uppercase text-[9px] flex items-center gap-1">
              <Droplets className="w-2.5 h-2.5 text-sky-400" />
              Humedad
            </span>
            <span className="font-bold text-slate-200 mt-0.5">
              {weather ? `${weather.humidity}%` : '--'}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-slate-500 font-bold uppercase text-[9px] flex items-center gap-1">
              <Wind className="w-2.5 h-2.5 text-emerald-400" />
              Viento
            </span>
            <span className="font-bold text-slate-200 mt-0.5">
              {weather ? `${weather.windSpeed} km/h` : '--'}
            </span>
          </div>
        </div>

      </div>

    </div>
  );
};
