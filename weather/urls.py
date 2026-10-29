from django.urls import path

from . import views
from .ai_views import ai_assistant


urlpatterns = [
    path("", views.home, name="home"),
    path("api/weather/", views.current_weather, name="current_weather"),
    path("api/forecast/", views.weather_forecast, name="weather_forecast"),
    path("api/assistant/", ai_assistant, name="ai_assistant"),
]