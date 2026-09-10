/* ═══════════════════════════════════════════════════════════════
   ENVIRONMENTAL GHOST — Ambient Context Layer for Longevity OS
   
   Fetches weather + air quality data and produces protocol
   modifiers that the AI Brain uses to dynamically rewrite
   the Daily Protocol. Caches aggressively to avoid API spam.
   
   Data Sources (client-side, no API key required):
   • Open-Meteo (weather + AQI) — free, no key needed
   • Browser Geolocation API for coordinates
   
   Output: EnvironmentalContext object consumed by:
   • AI Brain (generateContextualBrief) — injects env context
   • Coaching Engine — adjusts correction protocols
   • Daily Protocol — rewrites outdoor activities
   ═══════════════════════════════════════════════════════════════ */

/* ── Types ── */

export interface EnvironmentalContext {
  /** Current temperature in user's preferred unit */
  tempC: number;
  tempF: number;
  /** "Feels like" temperature */
  feelsLikeC: number;
  feelsLikeF: number;
  /** Relative humidity 0-100 */
  humidity: number;
  /** Wind speed km/h */
  windSpeedKmh: number;
  /** UV Index 0-11+ */
  uvIndex: number;
  /** Weather condition code (WMO) */
  weatherCode: number;
  /** Human-readable weather description */
  weatherDescription: string;
  /** Air Quality Index (US EPA standard 0-500) */
  aqi: number;
  /** AQI category */
  aqiCategory: AQICategory;
  /** PM2.5 concentration µg/m³ */
  pm25: number;
  /** PM10 concentration µg/m³ */
  pm10: number;
  /** Ozone µg/m³ */
  ozone: number;
  /** Is it currently daytime? */
  isDaytime: boolean;
  /** Precipitation probability % */
  precipitationProbability: number;
  /** Location coordinates */
  lat: number;
  lon: number;
  /** Location name (reverse geocoded or "Current Location") */
  locationName: string;
  /** When this data was fetched */
  fetchedAt: number;
  /** Overall environmental risk level */
  riskLevel: "optimal" | "moderate" | "elevated" | "hazardous";
  /** Protocol modifiers generated from environmental data */
  protocolModifiers: ProtocolModifier[];
  /** Sunrise/sunset times */
  sunrise: string;
  sunset: string;
}

export type AQICategory =
  | "good"
  | "moderate"
  | "unhealthy_sensitive"
  | "unhealthy"
  | "very_unhealthy"
  | "hazardous";

export interface ProtocolModifier {
  id: string;
  /** Which protocol categories this affects */
  affectedCategories: string[];
  /** The modification type */
  type: "relocate_indoor" | "reschedule" | "hydration_boost" | "uv_protection" | "cold_alert" | "heat_alert" | "air_quality_warning" | "optimal_window";
  /** Human-readable instruction */
  instruction: string;
  /** Clinical reasoning */
  reasoning: string;
  /** Severity */
  severity: "info" | "warning" | "critical";
  /** Icon */
  icon: string;
}

/* ── WMO Weather Code → Description Map ── */
const WMO_CODES: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

/* ── AQI Classification (US EPA breakpoints) ── */
function classifyAQI(aqi: number): AQICategory {
  if (aqi <= 50) return "good";
  if (aqi <= 100) return "moderate";
  if (aqi <= 150) return "unhealthy_sensitive";
  if (aqi <= 200) return "unhealthy";
  if (aqi <= 300) return "very_unhealthy";
  return "hazardous";
}

function aqiLabel(cat: AQICategory): string {
  const map: Record<AQICategory, string> = {
    good: "Good",
    moderate: "Moderate",
    unhealthy_sensitive: "Unhealthy for Sensitive Groups",
    unhealthy: "Unhealthy",
    very_unhealthy: "Very Unhealthy",
    hazardous: "Hazardous",
  };
  return map[cat];
}

/* ── PM2.5 → US EPA AQI Conversion ── */
function pm25ToAQI(pm25: number): number {
  const breakpoints = [
    { lo: 0, hi: 12.0, aqiLo: 0, aqiHi: 50 },
    { lo: 12.1, hi: 35.4, aqiLo: 51, aqiHi: 100 },
    { lo: 35.5, hi: 55.4, aqiLo: 101, aqiHi: 150 },
    { lo: 55.5, hi: 150.4, aqiLo: 151, aqiHi: 200 },
    { lo: 150.5, hi: 250.4, aqiLo: 201, aqiHi: 300 },
    { lo: 250.5, hi: 500.4, aqiLo: 301, aqiHi: 500 },
  ];
  for (const bp of breakpoints) {
    if (pm25 >= bp.lo && pm25 <= bp.hi) {
      return Math.round(((bp.aqiHi - bp.aqiLo) / (bp.hi - bp.lo)) * (pm25 - bp.lo) + bp.aqiLo);
    }
  }
  return pm25 > 500 ? 500 : 0;
}

/* ── Generate Protocol Modifiers from Environmental Data ── */
function generateProtocolModifiers(ctx: {
  tempC: number;
  feelsLikeC: number;
  humidity: number;
  windSpeedKmh: number;
  uvIndex: number;
  aqi: number;
  aqiCategory: AQICategory;
  pm25: number;
  weatherCode: number;
  precipitationProbability: number;
  isDaytime: boolean;
  sunrise: string;
  sunset: string;
}): ProtocolModifier[] {
  const mods: ProtocolModifier[] = [];

  /* ── Air Quality Modifiers ── */
  if (ctx.aqi > 100) {
    const severity = ctx.aqi > 200 ? "critical" : ctx.aqi > 150 ? "warning" : "warning";
    mods.push({
      id: "aqi_indoor_cardio",
      affectedCategories: ["training", "movement", "cardio"],
      type: "relocate_indoor",
      instruction: ctx.aqi > 200
        ? `AQI ${ctx.aqi} (${aqiLabel(ctx.aqiCategory)}) — Cancel ALL outdoor exercise. Move Zone 2 cardio indoors. PM2.5 at ${ctx.pm25.toFixed(1)} µg/m³ causes acute airway inflammation during elevated breathing rates.`
        : `AQI ${ctx.aqi} (${aqiLabel(ctx.aqiCategory)}) — Move Zone 2 cardio indoors. Outdoor exercise at this AQI increases particulate inhalation 5-10x due to elevated minute ventilation.`,
      reasoning: "During exercise, minute ventilation increases 10-20x, proportionally increasing particulate deposition in the alveoli. PM2.5 particles penetrate deep lung tissue and trigger systemic inflammation (elevated CRP, IL-6).",
      severity,
      icon: "🌫️",
    });
  }

  if (ctx.aqi > 150) {
    mods.push({
      id: "aqi_sunlight_skip",
      affectedCategories: ["biohacking", "supplement", "recovery"],
      type: "air_quality_warning",
      instruction: `Limit outdoor sunlight exposure to <10min. Supplement Vitamin D3 5000 IU to compensate. AQI ${ctx.aqi} makes extended outdoor time counterproductive.`,
      reasoning: "High particulate matter negates the hormonal benefits of sunlight exposure by triggering oxidative stress that outweighs UV-mediated vitamin D synthesis.",
      severity: "warning",
      icon: "☀️",
    });
  }

  /* ── Temperature Modifiers ── */
  if (ctx.feelsLikeC > 35) {
    mods.push({
      id: "heat_alert",
      affectedCategories: ["training", "movement", "cardio"],
      type: "heat_alert",
      instruction: `Feels like ${Math.round(ctx.feelsLikeC)}°C (${Math.round(ctx.feelsLikeC * 9/5 + 32)}°F) — Reschedule outdoor training to early AM (before ${ctx.sunrise}) or post-sunset (after ${ctx.sunset}). Add 500ml electrolyte water per 30min of activity.`,
      reasoning: "Core temperature rises 2-3x faster in extreme heat. Cardiac drift increases HR 10-15bpm at the same workload, making Zone 2 targets unreliable. Dehydration >2% bodyweight reduces VO2max by 10-20%.",
      severity: ctx.feelsLikeC > 40 ? "critical" : "warning",
      icon: "🔥",
    });
    mods.push({
      id: "heat_hydration",
      affectedCategories: ["nutrition", "supplement"],
      type: "hydration_boost",
      instruction: `Heat stress protocol: Add 1L electrolyte water above baseline. Include sodium 500mg, potassium 200mg, magnesium 100mg per liter. Pre-hydrate 500ml 2h before any activity.`,
      reasoning: "Sweat rate in extreme heat reaches 1-2L/hour. Electrolyte losses compound HRV depression and impair thermoregulation. Sodium is the primary electrolyte lost in sweat.",
      severity: "warning",
      icon: "💧",
    });
  }

  if (ctx.feelsLikeC < -10) {
    mods.push({
      id: "cold_alert",
      affectedCategories: ["training", "movement", "cardio"],
      type: "cold_alert",
      instruction: `Feels like ${Math.round(ctx.feelsLikeC)}°C (${Math.round(ctx.feelsLikeC * 9/5 + 32)}°F) — Move outdoor cardio indoors or layer appropriately. Cold air inhalation below -15°C causes bronchospasm in 40% of athletes.`,
      reasoning: "Sub-zero air temperatures cause airway cooling and drying, triggering exercise-induced bronchoconstriction. Peripheral vasoconstriction increases cardiac afterload, raising injury risk during high-intensity work.",
      severity: ctx.feelsLikeC < -20 ? "critical" : "warning",
      icon: "🥶",
    });
  }

  /* ── Cold Plunge Optimization ── */
  if (ctx.feelsLikeC < 5 && ctx.feelsLikeC > -10) {
    mods.push({
      id: "cold_plunge_natural",
      affectedCategories: ["biohacking", "recovery"],
      type: "optimal_window",
      instruction: `Ambient temp ${Math.round(ctx.feelsLikeC)}°C — Ideal for outdoor cold exposure. Reduce cold plunge duration by 30% as ambient temperature amplifies the hormetic stress signal.`,
      reasoning: "Cold ambient temperature pre-cools the body, reducing the thermal buffer. The same water temperature produces a stronger norepinephrine response when ambient air is also cold.",
      severity: "info",
      icon: "❄️",
    });
  }

  /* ── UV Index Modifiers ── */
  if (ctx.uvIndex >= 8 && ctx.isDaytime) {
    mods.push({
      id: "uv_protection",
      affectedCategories: ["training", "movement", "biohacking"],
      type: "uv_protection",
      instruction: `UV Index ${ctx.uvIndex} (Very High) — Limit unprotected sun exposure to 15min. Apply mineral sunscreen SPF 50+ for outdoor training. Wear UV-blocking eyewear to protect retinal cells.`,
      reasoning: "UV Index >8 causes DNA damage in keratinocytes within 10-15 minutes of unprotected exposure. Chronic UV overexposure accelerates photoaging and increases oxidative stress markers.",
      severity: "warning",
      icon: "🕶️",
    });
  } else if (ctx.uvIndex >= 3 && ctx.uvIndex < 8 && ctx.isDaytime) {
    mods.push({
      id: "uv_optimal_sunlight",
      affectedCategories: ["biohacking", "supplement"],
      type: "optimal_window",
      instruction: `UV Index ${ctx.uvIndex} — Optimal for Sunlight Protocol. 15-20min direct exposure will synthesize ~10,000 IU Vitamin D. Best window: within 2h of solar noon.`,
      reasoning: "UVB wavelengths (290-320nm) at this index are sufficient for cholecalciferol synthesis without excessive DNA damage risk. Morning sunlight also entrains circadian rhythm via melanopsin receptors.",
      severity: "info",
      icon: "☀️",
    });
  }

  /* ── Precipitation / Storm Modifiers ── */
  if (ctx.precipitationProbability > 70 || ctx.weatherCode >= 61) {
    mods.push({
      id: "rain_indoor",
      affectedCategories: ["training", "movement"],
      type: "relocate_indoor",
      instruction: `${WMO_CODES[ctx.weatherCode] || "Precipitation"} expected (${ctx.precipitationProbability}% probability) — Move outdoor protocols indoors. Substitute outdoor walk with indoor mobility flow or treadmill Zone 2.`,
      reasoning: "Wet surfaces increase injury risk. Rain reduces visibility and body temperature regulation efficiency. Indoor alternatives maintain protocol adherence without environmental friction.",
      severity: "info",
      icon: "🌧️",
    });
  }

  /* ── Humidity + Heat Combo ── */
  if (ctx.humidity > 80 && ctx.tempC > 28) {
    const wetBulbApprox = ctx.tempC * Math.atan(0.151977 * Math.sqrt(ctx.humidity + 8.313659));
    if (!mods.find(m => m.id === "heat_alert")) {
      mods.push({
        id: "humidity_heat",
        affectedCategories: ["training", "movement", "cardio"],
        type: "heat_alert",
        instruction: `High humidity (${ctx.humidity}%) + ${Math.round(ctx.tempC)}°C — Sweat evaporation is severely impaired. Reduce outdoor training intensity by 20% or move indoors. Wet bulb temp ~${Math.round(wetBulbApprox)}°C.`,
        reasoning: "When humidity exceeds 80% at temperatures above 28°C, evaporative cooling (the body's primary thermoregulation mechanism) drops by 50-70%. Core temperature rises rapidly, increasing heat stroke risk.",
        severity: "warning",
        icon: "💦",
      });
    }
  }

  /* ── Wind Chill for Outdoor Training ── */
  if (ctx.windSpeedKmh > 40 && ctx.tempC < 10) {
    mods.push({
      id: "wind_chill",
      affectedCategories: ["training", "movement"],
      type: "cold_alert",
      instruction: `Strong winds (${Math.round(ctx.windSpeedKmh)} km/h) with ${Math.round(ctx.tempC)}°C — Wind chill significantly increases heat loss. Layer with wind-resistant outer shell for any outdoor activity.`,
      reasoning: "Wind speed >40 km/h at low temperatures accelerates convective heat loss, increasing metabolic demand by 10-15% to maintain core temperature. This depletes glycogen reserves faster.",
      severity: "info",
      icon: "💨",
    });
  }

  return mods;
}

/* ── Compute Overall Risk Level ── */
function computeRiskLevel(mods: ProtocolModifier[]): "optimal" | "moderate" | "elevated" | "hazardous" {
  const hasCritical = mods.some(m => m.severity === "critical");
  const warningCount = mods.filter(m => m.severity === "warning").length;
  if (hasCritical) return "hazardous";
  if (warningCount >= 2) return "elevated";
  if (warningCount >= 1) return "moderate";
  return "optimal";
}

/* ── Cache Management ── */
const CACHE_KEY = "vive-env-ghost-cache";
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function getCachedContext(): EnvironmentalContext | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as EnvironmentalContext;
    if (Date.now() - cached.fetchedAt > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return cached;
  } catch {
    return null;
  }
}

function setCachedContext(ctx: EnvironmentalContext): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(ctx));
  } catch { /* quota exceeded — ignore */ }
}

/* ── Geolocation Helper ── */
function getUserLocation(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(err),
      { timeout: 10000, maximumAge: 600000 } // 10min cache on position
    );
  });
}

/* ── Fallback coordinates (NYC) if geolocation fails ── */
const FALLBACK_COORDS = { lat: 40.7128, lon: -74.006 };

/* ═══════════════════════════════════════════════════════════════
   fetchEnvironmentalContext — Main Entry Point
   
   1. Check cache (30min TTL)
   2. Get user coordinates (browser geolocation)
   3. Fetch Open-Meteo weather + air quality in parallel
   4. Compute protocol modifiers
   5. Cache and return
   ═══════════════════════════════════════════════════════════════ */

export async function fetchEnvironmentalContext(
  forceRefresh = false
): Promise<EnvironmentalContext> {
  /* ── 1. Check cache ── */
  if (!forceRefresh) {
    const cached = getCachedContext();
    if (cached) return cached;
  }

  /* ── 2. Get coordinates ── */
  let coords = FALLBACK_COORDS;
  let locationName = "New York, NY";
  try {
    coords = await getUserLocation();
    locationName = "Current Location";
  } catch {
    // Use fallback silently
  }

  /* ── 3. Fetch weather + AQI in parallel from Open-Meteo ── */
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,uv_index,is_day&daily=sunrise,sunset,precipitation_probability_max&timezone=auto&forecast_days=1`;
  const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${coords.lat}&longitude=${coords.lon}&current=pm10,pm2_5,ozone,us_aqi`;

  let weatherData: any = null;
  let aqiData: any = null;

  try {
    const [weatherRes, aqiRes] = await Promise.allSettled([
      fetch(weatherUrl).then(r => r.ok ? r.json() : null),
      fetch(aqiUrl).then(r => r.ok ? r.json() : null),
    ]);
    weatherData = weatherRes.status === "fulfilled" ? weatherRes.value : null;
    aqiData = aqiRes.status === "fulfilled" ? aqiRes.value : null;
  } catch {
    // Both failed — return minimal context
  }

  /* ── 4. Parse weather data ── */
  const current = weatherData?.current ?? {};
  const daily = weatherData?.daily ?? {};

  const tempC = current.temperature_2m ?? 20;
  const feelsLikeC = current.apparent_temperature ?? tempC;
  const humidity = current.relative_humidity_2m ?? 50;
  const windSpeedKmh = current.wind_speed_10m ?? 0;
  const uvIndex = current.uv_index ?? 0;
  const weatherCode = current.weather_code ?? 0;
  const isDaytime = current.is_day === 1;
  const precipitationProbability = daily.precipitation_probability_max?.[0] ?? 0;
  const sunrise = daily.sunrise?.[0]?.split("T")[1]?.slice(0, 5) ?? "06:30";
  const sunset = daily.sunset?.[0]?.split("T")[1]?.slice(0, 5) ?? "18:30";

  /* ── 5. Parse AQI data ── */
  const aqiCurrent = aqiData?.current ?? {};
  const pm25 = aqiCurrent.pm2_5 ?? 0;
  const pm10 = aqiCurrent.pm10 ?? 0;
  const ozone = aqiCurrent.ozone ?? 0;
  // Use the API's US AQI if available, otherwise compute from PM2.5
  const aqi = aqiCurrent.us_aqi ?? pm25ToAQI(pm25);
  const aqiCategory = classifyAQI(aqi);

  /* ── 6. Generate protocol modifiers ── */
  const protocolModifiers = generateProtocolModifiers({
    tempC, feelsLikeC, humidity, windSpeedKmh, uvIndex,
    aqi, aqiCategory, pm25, weatherCode,
    precipitationProbability, isDaytime, sunrise, sunset,
  });

  const riskLevel = computeRiskLevel(protocolModifiers);

  /* ── 7. Build context ── */
  const context: EnvironmentalContext = {
    tempC,
    tempF: Math.round(tempC * 9 / 5 + 32),
    feelsLikeC,
    feelsLikeF: Math.round(feelsLikeC * 9 / 5 + 32),
    humidity,
    windSpeedKmh,
    uvIndex,
    weatherCode,
    weatherDescription: WMO_CODES[weatherCode] ?? "Unknown",
    aqi,
    aqiCategory,
    pm25,
    pm10,
    ozone,
    isDaytime,
    precipitationProbability,
    lat: coords.lat,
    lon: coords.lon,
    locationName,
    fetchedAt: Date.now(),
    riskLevel,
    protocolModifiers,
    sunrise,
    sunset,
  };

  /* ── 8. Cache ── */
  setCachedContext(context);

  return context;
}

/* ═══════════════════════════════════════════════════════════════
   formatEnvironmentalBrief — For AI Brain Context Injection
   
   Returns a compact text block the LLM can consume to adjust
   its protocol recommendations based on environmental conditions.
   ═══════════════════════════════════════════════════════════════ */

export function formatEnvironmentalBrief(ctx: EnvironmentalContext): string {
  const lines: string[] = [
    "=== ENVIRONMENTAL CONTEXT (Live) ===",
    `Location: ${ctx.locationName} (${ctx.lat.toFixed(2)}, ${ctx.lon.toFixed(2)})`,
    `Weather: ${ctx.weatherDescription} | ${ctx.tempC.toFixed(1)}°C (feels like ${ctx.feelsLikeC.toFixed(1)}°C) | Humidity ${ctx.humidity}%`,
    `Wind: ${ctx.windSpeedKmh.toFixed(0)} km/h | UV Index: ${ctx.uvIndex} | ${ctx.isDaytime ? "Daytime" : "Nighttime"}`,
    `Precipitation: ${ctx.precipitationProbability}% probability`,
    `Air Quality: AQI ${ctx.aqi} (${aqiLabel(ctx.aqiCategory)}) | PM2.5: ${ctx.pm25.toFixed(1)} µg/m³ | PM10: ${ctx.pm10.toFixed(1)} µg/m³`,
    `Sunrise: ${ctx.sunrise} | Sunset: ${ctx.sunset}`,
    `Environmental Risk: ${ctx.riskLevel.toUpperCase()}`,
  ];

  if (ctx.protocolModifiers.length > 0) {
    lines.push("\nACTIVE ENVIRONMENTAL MODIFIERS:");
    for (const mod of ctx.protocolModifiers) {
      lines.push(`  ${mod.icon} [${mod.severity.toUpperCase()}] ${mod.instruction}`);
    }
  }

  lines.push("=== END ENVIRONMENTAL CONTEXT ===");
  return lines.join("\n");
}

/* ═══════════════════════════════════════════════════════════════
   getProtocolRewrite — Protocol-Specific Rewrite Suggestions
   
   Given a protocol name/category, returns the most relevant
   environmental modifier instruction, or null if no rewrite needed.
   ═══════════════════════════════════════════════════════════════ */

export function getProtocolRewrite(
  protocolName: string,
  protocolCategory: string,
  ctx: EnvironmentalContext
): { instruction: string; icon: string; severity: "info" | "warning" | "critical" } | null {
  const lowerName = protocolName.toLowerCase();
  const lowerCat = protocolCategory.toLowerCase();

  // Find the most severe modifier that matches this protocol
  const matching = ctx.protocolModifiers
    .filter(mod => {
      // Check category match
      if (mod.affectedCategories.some(c => lowerCat.includes(c))) return true;
      // Check name-based match
      if (lowerName.includes("walk") || lowerName.includes("run") || lowerName.includes("cardio") || lowerName.includes("zone 2")) {
        return mod.affectedCategories.includes("training") || mod.affectedCategories.includes("movement") || mod.affectedCategories.includes("cardio");
      }
      if (lowerName.includes("sun") || lowerName.includes("light")) {
        return mod.affectedCategories.includes("biohacking");
      }
      if (lowerName.includes("cold") || lowerName.includes("plunge") || lowerName.includes("ice")) {
        return mod.affectedCategories.includes("recovery") || mod.affectedCategories.includes("biohacking");
      }
      return false;
    })
    .sort((a, b) => {
      const sev = { critical: 0, warning: 1, info: 2 };
      return sev[a.severity] - sev[b.severity];
    });

  if (matching.length === 0) return null;

  const best = matching[0];
  return {
    instruction: best.instruction,
    icon: best.icon,
    severity: best.severity,
  };
}

/* ═══════════════════════════════════════════════════════════════
   Environmental Risk Color + Label Helpers
   ═══════════════════════════════════════════════════════════════ */

export function getRiskColor(level: EnvironmentalContext["riskLevel"]): string {
  const map = { optimal: "#00DC82", moderate: "#E8976C", elevated: "#FF9F0A", hazardous: "#FF453A" };
  return map[level];
}

export function getRiskLabel(level: EnvironmentalContext["riskLevel"]): string {
  const map = { optimal: "Optimal", moderate: "Moderate", elevated: "Elevated Risk", hazardous: "Hazardous" };
  return map[level];
}

export function getAQIColor(aqi: number): string {
  if (aqi <= 50) return "#00DC82";
  if (aqi <= 100) return "#E8D44D";
  if (aqi <= 150) return "#FF9F0A";
  if (aqi <= 200) return "#FF6B6B";
  if (aqi <= 300) return "#BF5AF2";
  return "#7D1128";
}
