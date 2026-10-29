import os
from datetime import datetime

import requests
from dotenv import load_dotenv
from django.views.decorators.csrf import ensure_csrf_cookie
from django.conf import settings
from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.http import require_GET


load_dotenv(settings.BASE_DIR / ".env")

CURRENT_WEATHER_URL = "https://api.openweathermap.org/data/2.5/weather"
FORECAST_URL = "https://api.openweathermap.org/data/2.5/forecast"


@ensure_csrf_cookie
def home(request):
    return render(request, "weather/home.html")


def get_location_params(request):
    """
    Return OpenWeather location parameters.

    Coordinates take priority when both coordinates and a city are provided.
    """
    latitude = request.GET.get("lat", "").strip()
    longitude = request.GET.get("lon", "").strip()
    city = request.GET.get("city", "").strip()

    if latitude or longitude:
        if not latitude or not longitude:
            return None, JsonResponse(
                {"error": "Both latitude and longitude are required."},
                status=400,
            )

        try:
            latitude = float(latitude)
            longitude = float(longitude)
        except ValueError:
            return None, JsonResponse(
                {"error": "Latitude and longitude must be valid numbers."},
                status=400,
            )

        if not (-90 <= latitude <= 90):
            return None, JsonResponse(
                {"error": "Latitude must be between -90 and 90."},
                status=400,
            )

        if not (-180 <= longitude <= 180):
            return None, JsonResponse(
                {"error": "Longitude must be between -180 and 180."},
                status=400,
            )

        return {
            "lat": latitude,
            "lon": longitude,
        }, None

    if city:
        return {"q": city}, None

    return None, JsonResponse(
        {"error": "Provide a city name or your latitude and longitude."},
        status=400,
    )


def get_api_key():
    """Return the configured OpenWeather API key."""
    return os.getenv("OPENWEATHER_API_KEY")


def weather_api_error(response, service_name):
    """Convert common OpenWeather errors into useful responses."""
    if response.status_code == 404:
        return JsonResponse(
            {"error": "Location not found. Try searching for a city."},
            status=404,
        )

    if response.status_code == 401:
        return JsonResponse(
            {"error": "The weather API key is invalid or not active yet."},
            status=502,
        )

    if response.status_code == 429:
        return JsonResponse(
            {"error": "The weather service rate limit was reached. Try again later."},
            status=503,
        )

    if response.status_code >= 400:
        return JsonResponse(
            {"error": f"The {service_name} service returned an error."},
            status=502,
        )

    return None


@require_GET
def current_weather(request):
    """Return current weather for a city or geographic coordinates."""
    location_params, error_response = get_location_params(request)

    if error_response:
        return error_response

    api_key = get_api_key()

    if not api_key:
        return JsonResponse(
            {"error": "Weather API key is not configured."},
            status=503,
        )

    params = {
        **location_params,
        "appid": api_key,
        "units": "metric",
    }

    try:
        response = requests.get(
            CURRENT_WEATHER_URL,
            params=params,
            timeout=10,
        )

        api_error = weather_api_error(response, "weather")
        if api_error:
            return api_error

        response.raise_for_status()
        data = response.json()

        weather = data["weather"][0]
        main = data["main"]

        result = {
            "city": data["name"],
            "country": data.get("sys", {}).get("country", ""),
            "temperature": round(main["temp"]),
            "feels_like": round(main["feels_like"]),
            "description": weather["description"].capitalize(),
            "condition": weather["main"],
            "icon": weather["icon"],
            "humidity": main["humidity"],
            "pressure": main["pressure"],
            "wind_speed": data.get("wind", {}).get("speed", 0),
            "latitude": data.get("coord", {}).get("lat"),
            "longitude": data.get("coord", {}).get("lon"),
        }

        return JsonResponse(result)

    except requests.Timeout:
        return JsonResponse(
            {"error": "The weather service took too long to respond. Try again."},
            status=504,
        )

    except requests.RequestException:
        return JsonResponse(
            {"error": "Unable to retrieve weather data. Please try again later."},
            status=502,
        )

    except (KeyError, IndexError, TypeError, ValueError):
        return JsonResponse(
            {"error": "The weather service returned an unexpected response."},
            status=502,
        )


@require_GET
def weather_forecast(request):
    """Return a five-day forecast for a city or geographic coordinates."""
    location_params, error_response = get_location_params(request)

    if error_response:
        return error_response

    api_key = get_api_key()

    if not api_key:
        return JsonResponse(
            {"error": "Weather API key is not configured."},
            status=503,
        )

    params = {
        **location_params,
        "appid": api_key,
        "units": "metric",
    }

    try:
        response = requests.get(
            FORECAST_URL,
            params=params,
            timeout=10,
        )

        api_error = weather_api_error(response, "forecast")
        if api_error:
            return api_error

        response.raise_for_status()
        data = response.json()

        daily_groups = {}

        for item in data["list"]:
            forecast_date = item["dt_txt"][:10]
            daily_groups.setdefault(forecast_date, []).append(item)

        forecasts = []

        for forecast_date, entries in list(daily_groups.items())[:5]:
            representative = min(
                entries,
                key=lambda item: abs(
                    int(item["dt_txt"][11:13]) - 12
                ),
            )

            temperatures = [
                item["main"]["temp"] for item in entries
            ]

            weather = representative["weather"][0]
            date_object = datetime.strptime(forecast_date, "%Y-%m-%d")

            forecasts.append({
                "date": forecast_date,
                "day": date_object.strftime("%a"),
                "description": weather["description"].capitalize(),
                "condition": weather["main"],
                "icon": weather["icon"],
                "temperature": round(representative["main"]["temp"]),
                "min_temperature": round(min(temperatures)),
                "max_temperature": round(max(temperatures)),
                "humidity": representative["main"]["humidity"],
                "wind_speed": representative.get(
                    "wind", {}
                ).get("speed", 0),
                "rain_probability": round(
                    representative.get("pop", 0) * 100
                ),
            })

        return JsonResponse({
            "city": data["city"]["name"],
            "country": data["city"]["country"],
            "forecast": forecasts,
        })

    except requests.Timeout:
        return JsonResponse(
            {"error": "The forecast service took too long to respond."},
            status=504,
        )

    except requests.RequestException:
        return JsonResponse(
            {"error": "Unable to retrieve forecast data. Try again later."},
            status=502,
        )

    except (KeyError, IndexError, TypeError, ValueError):
        return JsonResponse(
            {"error": "The weather service returned unexpected data."},
            status=502,
        )