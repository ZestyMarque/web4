const API_KEY = "f6aec960f0fcbdc574a2f22da749dd5c";
const WEATHER_URL = "https://api.openweathermap.org/data/2.5/forecast";
const GEO_URL = "https://api.openweathermap.org/geo/1.0/direct";

const citySelect = document.getElementById("citySelect");
const refreshBtn = document.getElementById("refreshBtn");

const loadingEl = document.getElementById("loading");
const errorEl = document.getElementById("error");
const weatherEl = document.getElementById("weather");

const locationTitle = document.getElementById("locationTitle");
const todayTemp = document.getElementById("todayTemp");
const todayDesc = document.getElementById("todayDesc");

const day1Date = document.getElementById("day1Date");
const day1Temp = document.getElementById("day1Temp");
const day2Date = document.getElementById("day2Date");
const day2Temp = document.getElementById("day2Temp");
const day3Date = document.getElementById("day3Date");
const day3Temp = document.getElementById("day3Temp");

const addCitySection = document.getElementById("addCitySection");
const cityInput = document.getElementById("cityInput");
const citySuggestions = document.getElementById("citySuggestions");
const cityError = document.getElementById("cityError");
const addCityBtn = document.getElementById("addCityBtn");

let state = {
    current: null,
    cities: [],
    selected: null
};

function saveState() {
    localStorage.setItem("weatherAppState", JSON.stringify(state));
}

function loadState() {
    const saved = localStorage.getItem("weatherAppState");
    if (saved) {
        state = JSON.parse(saved);
    }
}

function showLoading() {
    loadingEl.classList.remove("hidden");
    errorEl.classList.add("hidden");
    weatherEl.classList.add("hidden");
}

function showError() {
    loadingEl.classList.add("hidden");
    errorEl.classList.remove("hidden");
    weatherEl.classList.add("hidden");
}

function showWeather() {
    loadingEl.classList.add("hidden");
    errorEl.classList.add("hidden");
    weatherEl.classList.remove("hidden");
}

function updateCitySelect() {
    citySelect.innerHTML = "";

    if (state.current) {
        const option = document.createElement("option");
        option.value = "current";
        option.textContent = "Текущее местоположение";
        citySelect.appendChild(option);
    }

    state.cities.forEach(city => {
        const option = document.createElement("option");
        option.value = city;
        option.textContent = city;
        citySelect.appendChild(option);
    });

    citySelect.value = state.selected;
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "numeric" });
}

function renderWeather(data, title) {
    locationTitle.textContent = title;

    const today = data.list[0];
    todayTemp.textContent = Math.round(today.main.temp) + "°C";
    todayDesc.textContent = today.weather[0].description;

    const days = data.list.filter(item => item.dt_txt.includes("12:00:00"));

    day1Date.textContent = formatDate(days[0].dt_txt);
    day1Temp.textContent = Math.round(days[0].main.temp) + "°C";

    day2Date.textContent = formatDate(days[1].dt_txt);
    day2Temp.textContent = Math.round(days[1].main.temp) + "°C";

    day3Date.textContent = formatDate(days[2].dt_txt);
    day3Temp.textContent = Math.round(days[2].main.temp) + "°C";
}

async function fetchWeatherByCoords(lat, lon) {
    showLoading();
    try {
        const res = await fetch(`${WEATHER_URL}?lat=${lat}&lon=${lon}&units=metric&lang=ru&appid=${API_KEY}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        renderWeather(data, "Текущее местоположение");
        showWeather();
    } catch {
        showError();
    }
}

async function fetchWeatherByCity(city) {
    showLoading();
    try {
        const res = await fetch(`${WEATHER_URL}?q=${city}&units=metric&lang=ru&appid=${API_KEY}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        renderWeather(data, city);
        showWeather();
    } catch {
        showError();
    }
}

async function validateCity(name) {
    const res = await fetch(`${GEO_URL}?q=${name}&limit=5&appid=${API_KEY}`);
    const data = await res.json();
    return data;
}

function initGeolocation() {
    navigator.geolocation.getCurrentPosition(
        pos => {
            state.current = {
                lat: pos.coords.latitude,
                lon: pos.coords.longitude
            };
            state.selected = "current";
            saveState();
            updateCitySelect();
            fetchWeatherByCoords(state.current.lat, state.current.lon);
        },
        () => {
            addCitySection.classList.remove("hidden");
        }
    );
}

citySelect.addEventListener("change", () => {
    state.selected = citySelect.value;
    saveState();

    if (state.selected === "current") {
        fetchWeatherByCoords(state.current.lat, state.current.lon);
    } else {
        fetchWeatherByCity(state.selected);
    }
});

refreshBtn.addEventListener("click", () => {
    if (state.selected === "current") {
        fetchWeatherByCoords(state.current.lat, state.current.lon);
    } else {
        fetchWeatherByCity(state.selected);
    }
});

cityInput.addEventListener("input", async () => {
    const value = cityInput.value.trim();
    citySuggestions.innerHTML = "";
    cityError.classList.add("hidden");

    if (value.length < 2) {
        citySuggestions.classList.add("hidden");
        return;
    }

    const cities = await validateCity(value);
    if (cities.length === 0) {
        citySuggestions.classList.add("hidden");
        return;
    }

    cities.forEach(c => {
        const li = document.createElement("li");
        li.textContent = c.name;
        li.addEventListener("click", () => {
            cityInput.value = c.name;
            citySuggestions.classList.add("hidden");
        });
        citySuggestions.appendChild(li);
    });

    citySuggestions.classList.remove("hidden");
});

addCityBtn.addEventListener("click", async () => {
    const name = cityInput.value.trim();
    if (!name) return;

    const cities = await validateCity(name);
    if (cities.length === 0) {
        cityError.classList.remove("hidden");
        return;
    }

    if (!state.cities.includes(name)) {
        state.cities.push(name);
    }

    state.selected = name;
    cityInput.value = "";
    addCitySection.classList.add("hidden");

    saveState();
    updateCitySelect();
    fetchWeatherByCity(name);
});

loadState();

if (state.selected) {
    updateCitySelect();
    if (state.selected === "current" && state.current) {
        fetchWeatherByCoords(state.current.lat, state.current.lon);
    } else {
        fetchWeatherByCity(state.selected);
    }
} else {
    initGeolocation();
}
