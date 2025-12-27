// API ключ (замените на свой)
const API_KEY = 'f6aec960f0fcbdc574a2f22da749dd5c';
const API_BASE = 'https://api.openweathermap.org/data/2.5/forecast';

// Захардкоженный список городов для автокомплита (можно расширить)
const cities = [
    'Москва', 'Санкт-Петербург', 'Новосибирск', 'Екатеринбург', 'Казань',
    'Нижний Новгород', 'Челябинск', 'Омск', 'Самара', 'Ростов-на-Дону',
    'Уфа', 'Красноярск', 'Воронеж', 'Пермь', 'Волгоград'
];

// Элементы DOM
const cityForm = document.getElementById('city-form');
const cityInput = document.getElementById('city-input');
const citySuggestions = document.getElementById('city-suggestions');
const addCityBtn = document.getElementById('add-city-btn');
const cityError = document.getElementById('city-error');
const citiesList = document.getElementById('cities-list');
const refreshBtn = document.getElementById('refresh-btn');
const weatherContainer = document.getElementById('weather-container');
const loading = document.getElementById('loading');
const errorDiv = document.getElementById('error');
const weatherData = document.getElementById('weather-data');

// Переменные состояния
let currentCity = null;
let citiesArray = [];

// Загрузка при старте
window.addEventListener('load', () => {
    loadFromStorage();
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                fetchWeatherByCoords(latitude, longitude, 'Текущее местоположение');
            },
            () => {
                showCityForm();
            }
        );
    } else {
        showCityForm();
    }
});

// Показ формы города
function showCityForm() {
    cityForm.classList.remove('hidden');
}

// Автокомплит для городов
cityInput.addEventListener('input', () => {
    const query = cityInput.value.toLowerCase();
    citySuggestions.innerHTML = '';
    if (query) {
        const filtered = cities.filter(city => city.toLowerCase().includes(query));
        filtered.forEach(city => {
            const li = document.createElement('li');
            li.textContent = city;
            li.addEventListener('click', () => {
                cityInput.value = city;
                citySuggestions.classList.add('hidden');
            });
            citySuggestions.appendChild(li);
        });
        citySuggestions.classList.remove('hidden');
    } else {
        citySuggestions.classList.add('hidden');
    }
});

// Добавление города
addCityBtn.addEventListener('click', () => {
    const city = cityInput.value.trim();
    if (cities.includes(city) && !citiesArray.includes(city)) {
        citiesArray.push(city);
        saveToStorage();
        renderCities();
        cityInput.value = '';
        citySuggestions.classList.add('hidden');
        cityError.classList.add('hidden');
        if (!currentCity) {
            setCurrentCity(city);
        }
    } else {
        cityError.textContent = 'Город не найден или уже добавлен.';
        cityError.classList.remove('hidden');
    }
});

// Рендер списка городов
function renderCities() {
    citiesList.innerHTML = '';
    citiesArray.forEach(city => {
        const btn = document.createElement('button');
        btn.textContent = city;
        btn.classList.add('city-btn');
        if (city === currentCity) btn.classList.add('active');
        btn.addEventListener('click', () => setCurrentCity(city));
        citiesList.appendChild(btn);
    });
}

// Установка текущего города
function setCurrentCity(city) {
    currentCity = city;
    renderCities();
    fetchWeather(city);
}

// Запрос погоды по городу
function fetchWeather(city) {
    showLoading();
    fetch(`${API_BASE}?q=${city}&appid=${API_KEY}&units=metric&lang=ru`)
        .then(response => response.json())
        .then(data => {
            if (data.cod === '200') {
                displayWeather(data);
            } else {
                showError('Ошибка загрузки погоды.');
            }
        })
        .catch(() => showError('Ошибка сети.'))
        .finally(() => hideLoading());
}

// Запрос погоды по координатам
function fetchWeatherByCoords(lat, lon, label) {
    showLoading();
    fetch(`${API_BASE}?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=ru`)
        .then(response => response.json())
        .then(data => {
            if (data.cod === '200') {
                currentCity = label;
                citiesArray.unshift(label); // Добавляем в начало
                saveToStorage();
                renderCities();
                displayWeather(data);
            } else {
                showError('Ошибка загрузки погоды.');
            }
        })
        .catch(() => showError('Ошибка сети.'))
        .finally(() => hideLoading());
}

// Отображение погоды (сегодня + 2 дня)
function displayWeather(data) {
    const list = data.list;
    const days = {};
    
    list.forEach(item => {
        const date = new Date(item.dt * 1000).toDateString();
        if (!days[date]) {
            days[date] = { temps: [], desc: item.weather[0].description, icon: item.weather[0].icon };
        }
        days[date].temps.push(item.main.temp);
    });
    
    const dayKeys = Object.keys(days).slice(0, 3);
    weatherData.innerHTML = dayKeys.map(key => {
        const day = days[key];
        const avgTemp = (day.temps.reduce((a, b) => a + b) / day.temps.length).toFixed(1);
        const icon = `https://openweathermap.org/img/wn/${day.icon}@2x.png`;
        return `
            <div class="day">
                <h3>${new Date(key).toLocaleDateString('ru-RU', { weekday: 'long' })}</h3>
                <img src="${icon}" alt="${day.desc}">
                <p>${avgTemp}°C</p>
                <p>${day.desc}</p>
            </div>
        `;
    }).join('');
    
    weatherData.classList.remove('hidden');
    errorDiv.classList.add('hidden');
}

// Состояния
function showLoading() {
    loading.classList.remove('hidden');
    weatherData.classList.add('hidden');
    errorDiv.classList.add('hidden');
}

function hideLoading() {
    loading.classList.add('hidden');
}

function showError(msg) {
    errorDiv.textContent = msg;
    errorDiv.classList.remove('hidden');
    weatherData.classList.add('hidden');
}

// Обновление
refreshBtn.addEventListener('click', () => {
    if (currentCity) {
        if (currentCity === 'Текущее местоположение') {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    fetchWeatherByCoords(latitude, longitude, 'Текущее местоположение');
                },
                () => showError('Геолокация недоступна.')
            );
        } else {
            fetchWeather(currentCity);
        }
    }
});

// Сохранение/загрузка из localStorage
function saveToStorage() {
    localStorage.setItem('cities', JSON.stringify(citiesArray));
    localStorage.setItem('currentCity', currentCity);
}

function loadFromStorage() {
    const savedCities = localStorage.getItem('cities');
    const savedCurrent = localStorage.getItem('currentCity');
    if (savedCities) {
        citiesArray = JSON.parse(savedCities);
        renderCities();
    }
    if (savedCurrent) {
        currentCity = savedCurrent;
    }
}
