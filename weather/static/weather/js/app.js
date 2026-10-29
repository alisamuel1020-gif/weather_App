"use strict";


let searchForm;
let cityInput;
let searchButton;
let messageElement;
let themeToggle;
let forecastContainer;

let currentWeather = null;
let currentCity = "";
let currentForecast = [];
let assistantBusy = false;



document.addEventListener("DOMContentLoaded", () => {
    searchForm = document.getElementById("weather-search");
    cityInput = document.getElementById("city");
    searchButton = document.getElementById("searchButton");
    messageElement = document.getElementById("message");
    themeToggle = document.getElementById("themeToggle");
    forecastContainer = document.getElementById("forecastContainer");

    const yearElement = document.getElementById("currentYear");

    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }

    initializeTheme();
    initializeCityButtons();
    initializeSearch();
    initializeAssistant();

    detectUserLocation();
});




function initializeTheme() {
    if (!themeToggle) {
        return;
    }

    let savedTheme = "dark";

    try {
        savedTheme = localStorage.getItem("weatherai-theme") || "dark";
    } catch (error) {
        console.warn("Unable to read saved theme:", error);
    }

    document.body.classList.toggle(
        "light-theme",
        savedTheme === "light"
    );

    updateThemeButton();

    themeToggle.addEventListener("click", () => {
        document.body.classList.toggle("light-theme");

        const theme = document.body.classList.contains("light-theme")
            ? "light"
            : "dark";

        try {
            localStorage.setItem("weatherai-theme", theme);
        } catch (error) {
            console.warn("Unable to save theme:", error);
        }

        updateThemeButton();
    });
}


function updateThemeButton() {
    if (!themeToggle) {
        return;
    }

    const isLightTheme =
        document.body.classList.contains("light-theme");

    themeToggle.textContent = isLightTheme ? "☀" : "☾";

    themeToggle.setAttribute(
        "aria-label",
        isLightTheme
            ? "Switch to dark theme"
            : "Switch to light theme"
    );
}



function initializeSearch() {
    if (!searchForm || !cityInput) {
        console.error("Weather search form or city input was not found.");
        return;
    }

    searchForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const city = cityInput.value.trim();

        if (!city) {
            showStatus("Please enter a city name.", "error");
            cityInput.focus();
            return;
        }

        await searchWeather(city);
    });
}


function initializeCityButtons() {
    document.querySelectorAll(".city-chip").forEach((button) => {
        button.addEventListener("click", async () => {
            const city = button.dataset.city;

            if (!city) {
                return;
            }

            if (cityInput) {
                cityInput.value = city;
            }

            await searchWeather(city);
        });
    });
}


async function searchWeather(city) {
    setLoading(true);

    showStatus(`Getting weather for ${city}...`);
    setWeatherStatus("Loading...");

    if (forecastContainer) {
        forecastContainer.innerHTML = `
            <p class="forecast-placeholder">
                Loading forecast...
            </p>
        `;
    }

    try {
        const response = await fetch(
            `/api/weather/?city=${encodeURIComponent(city)}`
        );

        const data = await response.json();

        if (!response.ok || data.error) {
            throw new Error(
                data.error || "Unable to retrieve weather information."
            );
        }

        currentWeather = data;
        currentCity = data.city || city;
        currentForecast = [];

        updateWeatherDashboard(data);

        // Load the forecast for the same city.
        await loadForecast(currentCity);

        showStatus(
            `Weather updated for ${currentCity}.`,
            "success"
        );

        setWeatherStatus("Live data");

    } catch (error) {
        console.error("Weather search error:", error);

        showStatus(
            error.message ||
                "Unable to load weather. Please try again.",
            "error"
        );

        setWeatherStatus("Unavailable");

        if (forecastContainer) {
            forecastContainer.innerHTML = `
                <p class="forecast-placeholder">
                    Forecast unavailable. Please search for a city again.
                </p>
            `;
        }
    } finally {
        setLoading(false);
    }
}


function setLoading(isLoading) {
    if (!searchButton) {
        return;
    }

    searchButton.disabled = isLoading;

    searchButton.textContent = isLoading
        ? "Searching..."
        : "Search weather";
}


function updateWeatherDashboard(data) {
    setText("weatherLocation", data.city || "Unknown city");

    setText(
        "weatherCountry",
        data.country || "Current conditions"
    );

    setText(
        "temperature",
        formatTemperature(data.temperature)
    );

    setText(
        "weatherDescription",
        data.description || "Weather information unavailable"
    );

    setText(
        "feelsLike",
        `Feels like ${formatTemperature(data.feels_like)}`
    );

    setText(
        "humidity",
        formatValue(data.humidity, "%")
    );

    setText(
        "windSpeed",
        formatValue(data.wind_speed, " m/s")
    );

    setText(
        "pressure",
        formatValue(data.pressure, " hPa")
    );

    updateWeatherIcon(
        document.getElementById("weatherIcon"),
        data.icon,
        data.condition || data.description
    );
}


function setText(elementId, value) {
    const element = document.getElementById(elementId);

    if (element) {
        element.textContent = value;
    }
}


function setWeatherStatus(value) {
    setText("weatherStatus", value);
}


function formatTemperature(value) {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "--°";
    }

    const temperature = Number(value);

    if (!Number.isFinite(temperature)) {
        return "--°";
    }

    return `${Math.round(temperature)}°C`;
}


function formatValue(value, suffix = "") {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return `--${suffix}`;
    }

    const number = Number(value);

    if (!Number.isFinite(number)) {
        return `--${suffix}`;
    }

    return `${number}${suffix}`;
}




function updateWeatherIcon(element, icon, condition = "") {
    if (!element) {
        return;
    }

    const iconValue = String(icon || "").trim();

    if (/^\d{2}[dn]$/.test(iconValue)) {
        const image = document.createElement("img");

        image.src =
            `https://openweathermap.org/img/wn/${iconValue}@2x.png`;

        image.alt = condition || "Weather icon";

        element.replaceChildren(image);
        return;
    }

    if (
        /^https:\/\/openweathermap\.org\/img\/wn\/[\w@.]+\.png$/
            .test(iconValue)
    ) {
        const image = document.createElement("img");

        image.src = iconValue;
        image.alt = condition || "Weather icon";

        element.replaceChildren(image);
        return;
    }

    element.textContent = getWeatherEmoji(condition);
}


function getWeatherEmoji(condition = "") {
    const description = String(condition).toLowerCase();

    if (description.includes("thunder")) {
        return "⛈️";
    }

    if (description.includes("snow")) {
        return "❄️";
    }

    if (
        description.includes("rain") ||
        description.includes("drizzle")
    ) {
        return "🌧️";
    }

    if (description.includes("cloud")) {
        return "☁️";
    }

    if (
        description.includes("mist") ||
        description.includes("fog") ||
        description.includes("haze")
    ) {
        return "🌫️";
    }

    if (description.includes("clear")) {
        return "☀️";
    }

    return "🌤️";
}



async function loadForecast(city) {
    try {
        const response = await fetch(
            `/api/forecast/?city=${encodeURIComponent(city)}`
        );

        const data = await response.json();

        if (!response.ok || data.error) {
            throw new Error(
                data.error || "Unable to retrieve the forecast."
            );
        }

        const forecast = Array.isArray(data)
            ? data
            : data.forecast || data.data || data.list;

        if (!Array.isArray(forecast) || forecast.length === 0) {
            throw new Error("No forecast information was returned.");
        }

        currentForecast = forecast;

        renderForecast(forecast);

    } catch (error) {
        console.error("Forecast loading error:", error);

        currentForecast = [];

        if (forecastContainer) {
            forecastContainer.innerHTML = `
                <p class="forecast-placeholder">
                    We couldn't load the forecast. Your current
                    weather is still available.
                </p>
            `;
        }
    }
}


function renderForecast(forecast) {
    if (!forecastContainer) {
        return;
    }

    forecastContainer.replaceChildren();

    forecast.slice(0, 5).forEach((day, index) => {
        const card = document.createElement("article");

        card.className = "forecast-card";

        const dateValue =
            day.date ||
            day.datetime ||
            day.dt_txt ||
            day.day_date ||
            "";

        const date = parseForecastDate(dateValue);

        const dayName =
            day.day && !isDateLike(day.day)
                ? day.day
                : date
                    ? date.toLocaleDateString(undefined, {
                        weekday: "short"
                    })
                    : `Day ${index + 1}`;

        const dateLabel = date
            ? date.toLocaleDateString(undefined, {
                day: "numeric",
                month: "short"
            })
            : "";

        const condition =
            day.description ||
            day.condition ||
            day.weather_description ||
            "Weather information unavailable";

        const temperature =
            day.temperature ??
            day.temp ??
            day.temp_day ??
            day.temp_max;

        const minimum =
            day.min_temperature ??
            day.temp_min ??
            day.min_temp ??
            day.minimum;

        const maximum =
            day.max_temperature ??
            day.temp_max ??
            day.max_temp ??
            day.maximum;

        let rainProbability = day.rain_probability ??
            day.precipitation_probability;

        // OpenWeather's "pop" is a decimal between 0 and 1.
        if (
            rainProbability === undefined &&
            day.pop !== undefined &&
            day.pop !== null
        ) {
            rainProbability = Number(day.pop) * 100;
        }

        const iconMarkup = getForecastIconMarkup(
            day.icon || "",
            condition
        );

        const temperatureRangeMarkup =
            minimum !== undefined && maximum !== undefined
                ? `
                    <p class="forecast-temperature-range">
                        ${escapeHTML(formatTemperature(minimum))}
                        –
                        ${escapeHTML(formatTemperature(maximum))}
                    </p>
                `
                : "";

        const rainMarkup =
            rainProbability !== undefined &&
            rainProbability !== null &&
            rainProbability !== ""
                ? `
                    <p class="forecast-rain">
                        ☂ ${escapeHTML(formatRainProbability(rainProbability))}
                        rain
                    </p>
                `
                : "";

        card.innerHTML = `
            <p class="forecast-day">
                ${escapeHTML(dayName)}
            </p>

            <p class="forecast-date">
                ${escapeHTML(dateLabel)}
            </p>

            ${iconMarkup}

            <p class="forecast-condition">
                ${escapeHTML(condition)}
            </p>

            <p class="forecast-temperature">
                ${escapeHTML(formatTemperature(temperature))}
            </p>

            ${temperatureRangeMarkup}

            ${rainMarkup}
        `;

        forecastContainer.appendChild(card);
    });
}


function getForecastIconMarkup(icon, condition) {
    const iconValue = String(icon || "").trim();

    if (/^\d{2}[dn]$/.test(iconValue)) {
        return `
            <img
                class="forecast-icon"
                src="https://openweathermap.org/img/wn/${iconValue}@2x.png"
                alt="${escapeHTML(condition)}"
                loading="lazy"
            >
        `;
    }

    if (
        /^https:\/\/openweathermap\.org\/img\/wn\/[\w@.]+\.png$/
            .test(iconValue)
    ) {
        return `
            <img
                class="forecast-icon"
                src="${escapeHTML(iconValue)}"
                alt="${escapeHTML(condition)}"
                loading="lazy"
            >
        `;
    }

    return `
        <span class="forecast-emoji" aria-hidden="true">
            ${getWeatherEmoji(condition)}
        </span>
    `;
}


function parseForecastDate(value) {
    if (!value) {
        return null;
    }

    // Interpret YYYY-MM-DD as a local calendar date.
    const dateOnlyMatch = String(value).match(
        /^(\d{4})-(\d{2})-(\d{2})$/
    );

    if (dateOnlyMatch) {
        const year = Number(dateOnlyMatch[1]);
        const month = Number(dateOnlyMatch[2]) - 1;
        const day = Number(dateOnlyMatch[3]);

        return new Date(year, month, day);
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? null : date;
}


function isDateLike(value) {
    return typeof value === "string" &&
        /^\d{4}-\d{2}-\d{2}/.test(value);
}


function formatRainProbability(value) {
    const probability = Number(value);

    if (!Number.isFinite(probability)) {
        return "--%";
    }

    return `${Math.round(Math.max(0, Math.min(100, probability)))}%`;
}



function initializeAssistant() {
    const chatForm = document.getElementById("chatForm");
    const chatInput = document.getElementById("chatInput");

    if (!chatForm || !chatInput) {
        console.error("WeatherAI chat form or input was not found.");
        return;
    }

    chatForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const question = chatInput.value.trim();

        if (!question || assistantBusy) {
            return;
        }

        chatInput.value = "";

        await askWeatherAssistant(question);
    });

    document.querySelectorAll(".suggestion-button").forEach((button) => {
        button.addEventListener("click", async () => {
            const question = button.dataset.question;

            if (!question || assistantBusy) {
                return;
            }

            await askWeatherAssistant(question);
        });
    });
}


async function askWeatherAssistant(question) {
    if (assistantBusy) {
        return;
    }

    addChatMessage(question, "user");

    if (!currentWeather) {
        addChatMessage(
            "Please search for a city or allow location access before asking me about the weather.",
            "assistant"
        );
        return;
    }

    const chatForm = document.getElementById("chatForm");
    const chatInput = document.getElementById("chatInput");

    const submitButton = chatForm
        ? chatForm.querySelector('button[type="submit"]')
        : null;

    assistantBusy = true;

    if (submitButton) {
        submitButton.disabled = true;
    }

    if (chatInput) {
        chatInput.disabled = true;
    }

    const loadingMessage = addChatMessage(
        "WeatherAI is thinking...",
        "assistant"
    );

    try {
        const csrfToken = getCookie("csrftoken");

        if (!csrfToken) {
            throw new Error(
                "Security token unavailable. Refresh the page and try again."
            );
        }

        const response = await fetch("/api/assistant/", {
            method: "POST",
            mode: "same-origin",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": csrfToken
            },
            body: JSON.stringify({
                question: question,
                weather: currentWeather,
                forecast: currentForecast
            })
        });

        const data = await response.json();

        if (!response.ok || data.error) {
            throw new Error(
                data.error ||
                "The AI assistant could not answer right now."
            );
        }

        if (
            typeof data.answer !== "string" ||
            !data.answer.trim()
        ) {
            throw new Error(
                "The AI returned an empty response. Please try again."
            );
        }

        loadingMessage.textContent = data.answer;

    } catch (error) {
        console.error("WeatherAI assistant error:", error);

        loadingMessage.textContent =
            error.message ||
            "Something went wrong. Please try again.";
    } finally {
        assistantBusy = false;

        if (submitButton) {
            submitButton.disabled = false;
        }

        if (chatInput) {
            chatInput.disabled = false;
            chatInput.focus();
        }
    }
}



function addChatMessage(message, sender) {
    const chatMessages = document.getElementById("chatMessages");

    const messageElement = document.createElement("div");

    messageElement.className =
        sender === "user"
            ? "chat-message user-message"
            : "chat-message assistant-message";

    // Display text safely instead of interpreting it as HTML.
    messageElement.textContent = message;

    if (chatMessages) {
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    return messageElement;
}




function getCookie(name) {
    const cookies = document.cookie
        ? document.cookie.split(";")
        : [];

    for (const cookie of cookies) {
        const trimmedCookie = cookie.trim();

        if (trimmedCookie.startsWith(`${name}=`)) {
            return decodeURIComponent(
                trimmedCookie.substring(name.length + 1)
            );
        }
    }

    return null;
}




function detectUserLocation() {
    if (!navigator.geolocation) {
        showStatus(
            "Location detection is not supported by your browser. Search for a city instead.",
            "error"
        );
        return;
    }

    showStatus("Requesting your location...");

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;

            if (cityInput) {
                cityInput.value = "";
            }

            await searchWeatherByCoordinates(
                latitude,
                longitude
            );
        },

        (error) => {
            console.warn(
                "Location detection failed:",
                error.message
            );

            const messages = {
                1: "Location permission was denied. Enter a city to check its weather.",
                2: "Your location is unavailable. Please search for a city.",
                3: "Location detection timed out. Please search for a city."
            };

            showStatus(
                messages[error.code] ||
                "Unable to detect your location. Please search for a city.",
                "error"
            );

            setWeatherStatus("Location unavailable");
        },

        {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 300000
        }
    );
}


async function searchWeatherByCoordinates(latitude, longitude) {
    setLoading(true);

    showStatus("Loading weather for your current location...");
    setWeatherStatus("Loading...");

    if (forecastContainer) {
        forecastContainer.innerHTML = `
            <p class="forecast-placeholder">
                Loading forecast...
            </p>
        `;
    }

    try {
        const response = await fetch(
            `/api/weather/?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`
        );

        const data = await response.json();

        if (!response.ok || data.error) {
            throw new Error(
                data.error ||
                "Unable to retrieve weather for your location."
            );
        }

        currentWeather = data;
        currentCity = data.city || "Your location";
        currentForecast = [];

        updateWeatherDashboard(data);

        await loadForecastByCoordinates(
            latitude,
            longitude
        );

        showStatus(
            `Weather updated for ${currentCity}.`,
            "success"
        );

        setWeatherStatus("Live data");

    } catch (error) {
        console.error("Location weather error:", error);

        showStatus(
            error.message ||
            "Unable to load local weather. Try searching for a city.",
            "error"
        );

        setWeatherStatus("Unavailable");

    } finally {
        setLoading(false);
    }
}


async function loadForecastByCoordinates(latitude, longitude) {
    try {
        const response = await fetch(
            `/api/forecast/?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`
        );

        const data = await response.json();

        if (!response.ok || data.error) {
            throw new Error(
                data.error || "Unable to retrieve the forecast."
            );
        }

        const forecast = Array.isArray(data)
            ? data
            : data.forecast || data.data || data.list;

        if (!Array.isArray(forecast) || forecast.length === 0) {
            throw new Error("No forecast data was returned.");
        }

        currentForecast = forecast;

        renderForecast(forecast);

    } catch (error) {
        console.error("Location forecast error:", error);

        currentForecast = [];

        if (forecastContainer) {
            forecastContainer.innerHTML = `
                <p class="forecast-placeholder">
                    Your current weather is available, but the
                    forecast could not be loaded.
                </p>
            `;
        }
    }
}




function showStatus(message, type = "") {
    if (!messageElement) {
        return;
    }

    messageElement.textContent = message;
    messageElement.className = "status-message";

    if (type) {
        messageElement.classList.add(type);
    }
}


function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => {
        const replacements = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return replacements[character];
    });
}