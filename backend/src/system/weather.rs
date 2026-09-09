use axum::{
    extract::Query,
    http::StatusCode,
    response::{IntoResponse, Json},
};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::RwLock;
use std::time::{Duration, Instant};

#[derive(Debug, Deserialize)]
pub struct WeatherQuery {
    pub lat: Option<f64>,
    pub lon: Option<f64>,
    pub city: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeatherResponse {
    pub location_name: String,
    pub temperature_c: f64,
    pub apparent_temperature_c: f64,
    pub humidity: u32,
    pub wind_speed_kmh: f64,
    pub weather_code: u32,
    pub is_day: bool,
    pub condition_text: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
struct OpenMeteoCurrent {
    temperature_2m: Option<f64>,
    apparent_temperature: Option<f64>,
    relative_humidity_2m: Option<f64>,
    wind_speed_10m: Option<f64>,
    weather_code: Option<u32>,
    is_day: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct OpenMeteoResponse {
    current: Option<OpenMeteoCurrent>,
}

#[derive(Debug, Deserialize)]
struct GeocodingResult {
    name: String,
    latitude: f64,
    longitude: f64,
}

#[derive(Debug, Deserialize)]
struct GeocodingResponse {
    results: Option<Vec<GeocodingResult>>,
}

struct CacheEntry {
    data: WeatherResponse,
    cached_at: Instant,
}

static WEATHER_CACHE: Lazy<RwLock<HashMap<String, CacheEntry>>> =
    Lazy::new(|| RwLock::new(HashMap::new()));

const CACHE_TTL: Duration = Duration::from_secs(15 * 60); // 15 minutes

pub fn wmo_code_to_condition(code: u32) -> &'static str {
    match code {
        0 => "Céu Limpo",
        1 => "Principalmente Limpo",
        2 => "Parcialmente Nublado",
        3 => "Nublado",
        45 | 48 => "Neblina",
        51 | 53 | 55 => "Garoa",
        56 | 57 => "Garoa Congelante",
        61 | 63 | 65 => "Chuva",
        66 | 67 => "Chuva Congelante",
        71 | 73 | 75 => "Neve",
        77 => "Grãos de Neve",
        80 | 81 | 82 => "Pancadas de Chuva",
        85 | 86 => "Pancadas de Neve",
        95 => "Tempestade",
        96 | 99 => "Tempestade com Granizo",
        _ => "Parcialmente Nublado",
    }
}

pub async fn get_weather_handler(
    Query(q): Query<WeatherQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let mut lat = q.lat.unwrap_or(-23.5505);
    let mut lon = q.lon.unwrap_or(-46.6333);
    let mut location_name = q.city.unwrap_or_else(|| "Localização Atual".to_string());

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(4))
        .build()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // If city name was passed and no explicit lat/lon, try geocoding
    if q.lat.is_none() && q.lon.is_none() && !location_name.is_empty() && location_name != "Localização Atual" {
        let encoded_name = location_name.replace(' ', "+");
        let geocode_url = format!(
            "https://geocoding-api.open-meteo.com/v1/search?name={}&count=1&language=pt&format=json",
            encoded_name
        );
        if let Ok(res) = client.get(&geocode_url).send().await {
            if let Ok(geo) = res.json::<GeocodingResponse>().await {
                if let Some(first) = geo.results.and_then(|r| r.into_iter().next()) {
                    lat = first.latitude;
                    lon = first.longitude;
                    location_name = first.name;
                }
            }
        }
    }

    let cache_key = format!("{:.2}_{:.2}", lat, lon);

    // Check cache
    if let Ok(cache) = WEATHER_CACHE.read() {
        if let Some(entry) = cache.get(&cache_key) {
            if entry.cached_at.elapsed() < CACHE_TTL {
                let mut cached_data = entry.data.clone();
                cached_data.location_name = location_name;
                return Ok(Json(cached_data));
            }
        }
    }

    // Query Open-Meteo
    let forecast_url = format!(
        "https://api.open-meteo.com/v1/forecast?latitude={}&longitude={}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m&timezone=auto",
        lat, lon
    );

    let fetch_res = client.get(&forecast_url).send().await;

    let weather_response = match fetch_res {
        Ok(res) if res.status().is_success() => {
            let data = res.json::<OpenMeteoResponse>().await.ok();
            if let Some(curr) = data.and_then(|d| d.current) {
                let code = curr.weather_code.unwrap_or(0);
                WeatherResponse {
                    location_name: location_name.clone(),
                    temperature_c: curr.temperature_2m.unwrap_or(22.0),
                    apparent_temperature_c: curr.apparent_temperature.unwrap_or(22.0),
                    humidity: curr.relative_humidity_2m.unwrap_or(60.0) as u32,
                    wind_speed_kmh: curr.wind_speed_10m.unwrap_or(12.0),
                    weather_code: code,
                    is_day: curr.is_day.unwrap_or(1) == 1,
                    condition_text: wmo_code_to_condition(code).to_string(),
                    updated_at: time::OffsetDateTime::now_utc()
                        .format(&time::format_description::well_known::Rfc3339)
                        .unwrap_or_default(),
                }
            } else {
                build_fallback_weather(&location_name)
            }
        }
        _ => build_fallback_weather(&location_name),
    };

    // Store in cache
    if let Ok(mut cache) = WEATHER_CACHE.write() {
        cache.insert(
            cache_key,
            CacheEntry {
                data: weather_response.clone(),
                cached_at: Instant::now(),
            },
        );
    }

    Ok(Json(weather_response))
}

fn build_fallback_weather(name: &str) -> WeatherResponse {
    WeatherResponse {
        location_name: name.to_string(),
        temperature_c: 24.0,
        apparent_temperature_c: 25.0,
        humidity: 62,
        wind_speed_kmh: 11.5,
        weather_code: 1,
        is_day: true,
        condition_text: "Ensolarado com Poucas Nuvens".to_string(),
        updated_at: time::OffsetDateTime::now_utc()
            .format(&time::format_description::well_known::Rfc3339)
            .unwrap_or_default(),
    }
}
