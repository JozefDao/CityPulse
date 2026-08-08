import {
  CityDashboardAirQualityDto,
  CityDashboardCurrentDto,
  CityDashboardDailyDto,
  CityDashboardHourlyDto,
} from '../dto/city-dashboard.dto';

type OMCurrent = {
  current?: {
    time?: string;
    temperature_2m?: number;
    apparent_temperature?: number;
    relative_humidity_2m?: number;
    precipitation?: number;
    wind_speed_10m?: number;
    wind_gusts_10m?: number;
    wind_direction_10m?: number;
    weather_code?: number;
  };
};

type OMHourly = {
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    precipitation?: number[];
    wind_speed_10m?: number[];
    wind_gusts_10m?: number[];
    relative_humidity_2m?: number[];
    weather_code?: number[];
  };
};

type OMDaily = {
  daily?: {
    time?: string[];
    temperature_2m_min?: number[];
    temperature_2m_max?: number[];
    precipitation_sum?: number[];
    wind_speed_10m_max?: number[];
    sunrise?: string[];
    sunset?: string[];
  };
};

type OMAir = {
  hourly?: {
    time?: string[];
    pm2_5?: number[];
    pm10?: number[];
    nitrogen_dioxide?: number[];
    ozone?: number[];
  };
};

export function mapCurrent(snapshot: unknown): CityDashboardCurrentDto {
  const payload = snapshot as OMCurrent;
  const current = payload?.current;
  return {
    time: current?.time,
    temperature: current?.temperature_2m,
    apparentTemperature: current?.apparent_temperature,
    humidity: current?.relative_humidity_2m,
    precipitation: current?.precipitation,
    windSpeed: current?.wind_speed_10m,
    windGusts: current?.wind_gusts_10m,
    windDirection: current?.wind_direction_10m,
    weatherCode: current?.weather_code,
  };
}

export function mapHourly(snapshot: unknown): CityDashboardHourlyDto {
  const payload = snapshot as OMHourly;
  const hourly = payload?.hourly;
  return {
    times: hourly?.time ?? [],
    temperature: hourly?.temperature_2m,
    precipitation: hourly?.precipitation,
    windSpeed: hourly?.wind_speed_10m,
    windGusts: hourly?.wind_gusts_10m,
    humidity: hourly?.relative_humidity_2m,
    weatherCode: hourly?.weather_code,
  };
}

export function mapDaily(snapshot: unknown): CityDashboardDailyDto {
  const payload = snapshot as OMDaily;
  const daily = payload?.daily;
  return {
    dates: daily?.time ?? [],
    tempMin: daily?.temperature_2m_min,
    tempMax: daily?.temperature_2m_max,
    precipitationSum: daily?.precipitation_sum,
    windMax: daily?.wind_speed_10m_max,
    sunrise: daily?.sunrise,
    sunset: daily?.sunset,
  };
}

export function mapAir(snapshot: unknown): CityDashboardAirQualityDto {
  const payload = snapshot as OMAir;
  const hourly = payload?.hourly;
  return {
    times: hourly?.time ?? [],
    pm25: hourly?.pm2_5,
    pm10: hourly?.pm10,
    no2: hourly?.nitrogen_dioxide,
    o3: hourly?.ozone,
  };
}
