class WeatherApp {
    constructor() {
        this.API_KEY = 'f6aec960f0fcbdc574a2f22da749dd5c';
        this.baseUrl = 'https://api.openweather.org/data/2.5';
        this.cities = JSON.parse(localStorage.getItem('weatherCities')) || [];
        this.currentLocation = JSON.parse(localStorage.getItem('currentLocation')) || null;
        this.citySuggestions = ['Москва', 'Санкт-Петербург', 'Новосибирск', 'Екатеринбург', 'Казань', 
                               'Нижний Новгород', 'Челябинск', 'Самара', 'Омск', 'Ростов-на-Дону',
                               'London', 'Paris', 'Berlin', 'Madrid', 'Rome', 'New York', 'Tokyo'];
        
        this.init();
    }

    init() {
        this.bindEvents();
        if (this.currentLocation) {
            this.loadWeatherForCurrent();
            this.loadCitiesWeather();
            this.renderCitiesList();
        } else {
            this.requestGeolocation();
        }
    }

    bindEvents() {
        document.getElementById('refreshBtn').addEventListener('click', () => this.refreshAll());
        document.getElementById('addCityBtn').addEventListener('click', () => this.addCity());
        document.getElementById('cityInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addCity();
        });
        document.getElementById('cityInput').addEventListener('input', (e) => this.showSuggestions(e.target.value));
    }

    requestGeolocation() {
        if (!navigator.geolocation) {
            this.showCityInput();
            return;
        }

        this.setMainStatus('loading');
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                this.currentLocation = { lat: latitude, lon: longitude, type: 'geo' };
                localStorage.setItem('currentLocation', JSON.stringify(this.currentLocation));
                this.loadWeatherForCurrent();
            },
            (error) => {
                console.log('Geolocation denied:', error);
                this.showCityInput();
            }
        );
    }

    showCityInput() {
        document.getElementById('mainTitle').textContent = 'Введите город';
        document.getElementById('mainContent').innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <input type="text" id="initialCityInput" placeholder="Введите название города" style="padding: 12px; border-radius: 10px; border: 2px solid #dfe6e9; font-size: 1.1em; width: 70%; max-width: 300px;">
                <br><br>
                <button onclick="app.addInitialCity()" style="background: linear-gradient(45deg, #00b894, #00cec9); color: white; border: none; padding: 12px 24px; border-radius: 10px; cursor: pointer; font-size: 1.1em;">Показать погоду</button>
            </div>
        `;
    }

    addInitialCity() {
        const cityInput = document.getElementById('initialCityInput');
        const city = cityInput.value.trim();
        if (city) {
            this.currentLocation = { name: city, type: 'manual' };
            localStorage.setItem('currentLocation', JSON.stringify(this.currentLocation));
            this.loadWeatherForCurrent();
        }
    }

    async loadWeatherForCurrent() {
        this.setMainStatus('loading');
        try {
            const data = await this.fetchWeatherForecast(this.currentLocation);
            this.renderMainForecast(data);
            this.setMainStatus('success');
        } catch (error) {
            console.error('Error loading main weather:', error);
            document.getElementById('mainContent').innerHTML = '<div class="error">Не удалось загрузить прогноз</div>';
            this.setMainStatus('error');
        }
    }

    async loadCitiesWeather() {
        for (let city of this.cities) {
            try {
                const data = await this.fetchWeatherForecast({ name: city.name });
                city.today = data.today;
                city.days = data.days;
            } catch (error) {
                console.error(`Error loading weather for ${city.name}:`, error);
            }
        }
        this.saveCities();
    }

    async addCity() {
        const cityInput = document.getElementById('cityInput');
        const cityName = cityInput.value.trim();
        
        if (!cityName || this.cities.some(city => city.name.toLowerCase() === cityName.toLowerCase())) {
            this.showCityError('Город уже добавлен или поле пустое');
            return;
        }

        document.getElementById('cityError').classList.add('hidden');
        cityInput.value = '';

        try {
            const data = await this.fetchWeatherForecast({ name: cityName });
            const cityData = { name: data.city, today: data.today, days: data.days };
            this.cities.push(cityData);
            this.saveCities();
            this.renderCitiesList();
        } catch (error) {
            this.showCityError('Город не найден');
        }
    }

    showSuggestions(query) {
        const datalist = document.getElementById('citySuggestions');
        datalist.innerHTML = '';
        
        if (!query) return;
        
        const filtered = this.citySuggestions
            .filter(city => city.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 5);
            
        filtered.forEach(city => {
            const option = document.createElement('option');
            option.value = city;
            datalist.appendChild(option);
        });
    }

    showCityError(message) {
        const errorEl = document.getElementById('cityError');
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
    }

    async refreshAll() {
        // Обновляем основной прогноз
        await this.loadWeatherForCurrent();
        
        // Обновляем города
        await this.loadCitiesWeather();
        this.renderCitiesList();
        this.setMainStatus('success');
    }

    async fetchWeatherForecast(location) {
        let url;
        if (location.lat && location.lon) {
            url = `${this.baseUrl}/forecast?lat=${location.lat}&lon=${location.lon}&units=metric&lang=ru&appid=${this.API_KEY}`;
        } else {
            url = `${this.baseUrl}/forecast?q=${encodeURIComponent(location.name)}&units=metric&lang=ru&appid=${this.API_KEY}`;
        }

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return this.parseForecastData(data);
    }

    parseForecastData(apiData) {
        const city = apiData.city.name;
        const todayIndex = apiData.list.findIndex(item => {
            const now = new Date();
            const itemTime = new Date(item.dt * 1000);
            return itemTime.getDate() === now.getDate() && 
                   itemTime.getMonth() === now.getMonth();
        });
        
        const today = apiData.list[todayIndex >= 0 ? todayIndex : 0];
        
        // Группируем по дням (следующие 3 дня)
        const daysData = {};
        apiData.list.slice(0, 40).forEach(item => { // Берем 40 записей (~5 дней)
            const dateKey = item.dt_txt.split(' ')[0];
            if (!daysData[dateKey]) {
                daysData[dateKey] = {
                    date: dateKey,
                    temp_min: item.main.temp,
                    temp_max: item.main.temp,
                    description: item.weather[0].description,
                    icon: item.weather[0].icon
                };
            } else {
                daysData[dateKey].temp_min = Math.min(daysData[dateKey].temp_min, item.main.temp);
                daysData[dateKey].temp_max = Math.max(daysData[dateKey].temp_max, item.main.temp);
            }
        });

        const daysArray = Object.values(daysData);
        return {
            city,
            today: {
                temp: Math.round(today.main.temp),
                description: today.weather[0].description,
                icon: today.weather[0].icon
            },
            days: daysArray.slice(1, 3) // Следующие 2 дня
        };
    }

    renderMainForecast(data) {
        const title = this.currentLocation.type === 'geo' ? 'Текущее местоположение' : data.city;
        document.getElementById('mainTitle').textContent = title;
        
        const container = document.getElementById('mainContent');
        container.className = 'weather-content';
        container.innerHTML = `
            <div class="forecast-grid">
                <div class="forecast-day">
                    <div class="day-icon">🎄</div>
                    <div class="temp">${data.today.temp}°</div>
                    <div class="description">${data.today.description}</div>
                    <div class="date">Сегодня</div>
                </div>
                ${data.days.map(day => `
                    <div class="forecast-day">
                        <div class="day-icon">❄️</div>
                        <div class="temp">${Math.round(day.temp_min)}° / ${Math.round(day.temp_max)}°</div>
                        <div class="description">${day.description}</div>
                        <div class="date">${this.formatDate(day.date)}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderCitiesList() {
        const container = document.getElementById('citiesList');
        if (this.cities.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #b2bec3;">Добавьте города для просмотра прогноза</p>';
            return;
        }

        container.innerHTML = `
            <div class="city-tabs">
                ${this.cities.map((city, index) => 
                    `<button class="city-tab ${index === 0 ? 'active' : ''}" data-index="${index}">${city.name}</button>`
                ).join('')}
            </div>
            <div id="cityForecasts">
                ${this.cities.map((city, index) => this.renderCityForecast(city)).join('')}
            </div>
        `;

        // Обработчики вкладок
        document.querySelectorAll('.city-tab').forEach((tab, index) => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.city-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.city-forecast').forEach(f => f.classList.add('hidden'));
                tab.classList.add('active');
                document.querySelector(`[data-city-index="${index}"]`).classList.remove('hidden');
            });
        });
    }

    renderCityForecast(city) {
        return `
            <div class="weather-section city-forecast hidden" data-city-index="${this.cities.indexOf(city)}">
                <div class="weather-header">
                    <h2>${city.name}</h2>
                    <span class="status success">✓</span>
                </div>
                <div class="weather-content">
                    <div class="forecast-grid">
                        <div class="forecast-day">
                            <div class="day-icon">🎄</div>
                            <div class="temp">${city.today ? city.today.temp + '°' : '—'}</div>
                            <div class="description">${city.today ? city.today.description : 'Загрузка...'}</div>
                            <div class="date">Сегодня</div>
                        </div>
                        ${city.days ? city.days.map(day => `
                            <div class="forecast-day">
                                <div class="day-icon">❄️</div>
                                <div class="temp">${Math.round(day.temp_min)}° / ${Math.round(day.temp_max)}°</div>
                                <div class="description">${day.description}</div>
                                <div class="date">${this.formatDate(day.date)}</div>
                            </div>
                        `).join('') : '<div class="forecast-day"><div>Загрузка...</div></div>'}
                    </div>
                </div>
            </div>
        `;
    }

    setMainStatus(status) {
        const statusEl = document.getElementById('mainStatus');
        statusEl.textContent = status === 'loading' ? '⏳ Загрузка...' : 
                              status === 'success' ? '✨ Готово!' : '❌ Ошибка';
        statusEl.className = `status ${status}`;
        document.getElementById('mainContent').className = `weather-content ${status}`;
    }

    formatDate(dateStr) {
        const date = new Date(dateStr);
        const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
        return days[date.getDay()];
    }

    saveCities() {
        localStorage.setItem('weatherCities', JSON.stringify(this.cities));
    }
}

const app = new WeatherApp();
window.app = app;
