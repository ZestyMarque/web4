class WeatherApp {
    constructor() {
        this.API_KEY = 'f6aec960f0fcbdc574a2f22da749dd5c';
        this.baseUrl = 'https://api.openweathermap.org/data/2.5';
        this.cities = JSON.parse(localStorage.getItem('weatherCities')) || [];
        this.currentLocation = JSON.parse(localStorage.getItem('currentLocation')) || null;
        this.citySuggestions = ['Москва', 'Санкт-Петербург', 'Новосибирск', 'Екатеринбург', 'Казань', 
                               'Нижний Новгород', 'Челябинск', 'Самара', 'Омск', 'Ростов-на-Дону',
                               'London', 'Paris', 'Berlin', 'Madrid', 'Rome', 'New York', 'Tokyo'];
        this.init();
    }

    init() {
        this.bindEvents();
        
        // Если есть сохраненные данные - загружаем
        if (this.currentLocation) {
            document.getElementById('mainTitle').textContent = this.currentLocation.type === 'geo' ? 
                'Текущее местоположение' : this.currentLocation.name;
            this.loadWeatherForCurrent();
        } else {
            this.requestGeolocation();
        }
        
        if (this.cities.length > 0) {
            this.renderCitiesList();
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
        document.getElementById('mainStatus').textContent = '⏳ Запрашиваем геолокацию...';
        
        if (!navigator.geolocation) {
            this.showManualCityInput();
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                this.currentLocation = { lat: latitude, lon: longitude, type: 'geo' };
                localStorage.setItem('currentLocation', JSON.stringify(this.currentLocation));
                document.getElementById('mainTitle').textContent = 'Текущее местоположение';
                this.loadWeatherForCurrent();
            },
            (error) => {
                console.log('Geolocation error:', error);
                this.showManualCityInput();
            },
            { timeout: 10000, enableHighAccuracy: true }
        );
    }

    showManualCityInput() {
        document.getElementById('mainTitle').textContent = 'Введите город';
        document.getElementById('mainContent').innerHTML = `
            <div style="text-align: center; padding: 40px; color: rgba(255,255,255,0.9);">
                <input type="text" id="initialCityInput" placeholder="Например: Москва" 
                       style="padding: 15px; border-radius: 15px; border: 2px solid rgba(255,255,255,0.3); font-size: 1.1em; width: 80%; max-width: 350px; background: rgba(255,255,255,0.1); color: white; margin-bottom: 20px;">
                <br>
                <button id="initialCityBtn" style="background: linear-gradient(45deg, #ff6b6b, #feca57); color: white; border: none; padding: 15px 30px; border-radius: 15px; cursor: pointer; font-size: 1.1em;">Показать погоду</button>
            </div>
        `;
        
        document.getElementById('initialCityBtn').addEventListener('click', () => this.addInitialCity());
    }

    addInitialCity() {
        const cityInput = document.getElementById('initialCityInput');
        const city = cityInput.value.trim();
        if (!city) return;
        
        this.currentLocation = { name: city, type: 'manual' };
        localStorage.setItem('currentLocation', JSON.stringify(this.currentLocation));
        document.getElementById('mainTitle').textContent = city;
        this.loadWeatherForCurrent();
    }

    async loadWeatherForCurrent() {
        this.setMainStatus('loading');
        try {
            const data = await this.fetchWeatherForecast(this.currentLocation);
            this.renderMainForecast(data);
            this.setMainStatus('success');
        } catch (error) {
            console.error('Main weather error:', error);
            this.setMainStatus('error');
        }
    }

    async addCity() {
        const cityInput = document.getElementById('cityInput');
        const cityName = cityInput.value.trim();
        
        if (!cityName) {
            this.showCityError('Введите название города');
            return;
        }
        
        if (this.cities.some(city => city.name.toLowerCase() === cityName.toLowerCase())) {
            this.showCityError('Город уже добавлен');
            return;
        }

        this.setCityInputStatus('loading');
        
        try {
            const data = await this.fetchWeatherForecast({ name: cityName });
            const cityData = { 
                name: data.city, 
                today: data.today, 
                days: data.days,
                lastUpdated: Date.now()
            };
            this.cities.push(cityData);
            this.saveCities();
            cityInput.value = '';
            document.getElementById('cityError').classList.add('hidden');
            this.renderCitiesList();
            this.setCityInputStatus('success');
        } catch (error) {
            console.error('Add city error:', error);
            this.showCityError('Город не найден. Проверьте написание.');
            this.setCityInputStatus('error');
        }
    }

    setCityInputStatus(status) {
        const errorEl = document.getElementById('cityError');
        if (status === 'loading') {
            errorEl.innerHTML = '⏳ Проверяем город...';
            errorEl.classList.remove('hidden');
        } else if (status === 'success') {
            errorEl.innerHTML = '✅ Город добавлен!';
            errorEl.classList.remove('hidden');
            setTimeout(() => errorEl.classList.add('hidden'), 2000);
        }
    }

    showSuggestions(query) {
        const datalist = document.getElementById('citySuggestions');
        datalist.innerHTML = '';
        if (!query || query.length < 2) return;
        
        const filtered = this.citySuggestions
            .filter(city => city.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 6);
            
        filtered.forEach(city => {
            const option = document.createElement('option');
            option.value = city;
            datalist.appendChild(option);
        });
    }

    showCityError(message) {
        const errorEl = document.getElementById('cityError');
        errorEl.textContent = `❌ ${message}`;
        errorEl.classList.remove('hidden');
    }

    async refreshAll() {
        this.setMainStatus('loading');
        await this.loadWeatherForCurrent();
        
        for (let city of this.cities) {
            try {
                const data = await this.fetchWeatherForecast({ name: city.name });
                city.today = data.today;
                city.days = data.days;
                city.lastUpdated = Date.now();
            } catch (error) {
                console.error(`Refresh ${city.name}:`, error);
            }
        }
        this.saveCities();
        this.renderCitiesList();
    }

    async fetchWeatherForecast(location) {
        let url;
        if (location.lat !== undefined && location.lon !== undefined) {
            url = `${this.baseUrl}/forecast?lat=${location.lat}&lon=${location.lon}&units=metric&lang=ru&appid=${this.API_KEY}`;
        } else {
            url = `${this.baseUrl}/forecast?q=${encodeURIComponent(location.name)}&units=metric&lang=ru&appid=${this.API_KEY}`;
        }

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        if (!data.list || data.list.length === 0) {
            throw new Error('No weather data');
        }
        
        return this.parseForecastData(data);
    }

    parseForecastData(apiData) {
        const city = apiData.city?.name || 'Неизвестный город';
        
        // Сегодняшний день - ближайший к текущему времени
        const now = new Date().getTime() / 1000;
        const todayItem = apiData.list.find(item => 
            Math.abs(item.dt - now) < 10800 // 3 часа
        ) || apiData.list[0];

        // Группируем по дням
        const days = {};
        apiData.list.slice(0, 24).forEach(item => {
            const dateStr = item.dt_txt.split(' ')[0];
            if (!days[dateStr]) {
                days[dateStr] = {
                    date: dateStr,
                    temps: [],
                    descriptions: [],
                    icons: []
                };
            }
            days[dateStr].temps.push(item.main.temp);
            days[dateStr].descriptions.push(item.weather[0].description);
            days[dateStr].icons.push(item.weather[0].icon);
        });

        const daysArray = Object.values(days).map(day => ({
            date: day.date,
            temp_min: Math.round(Math.min(...day.temps)),
            temp_max: Math.round(Math.max(...day.temps)),
            description: day.descriptions[0],
            icon: day.icons[0]
        }));

        return {
            city,
            today: {
                temp: Math.round(todayItem.main.temp),
                description: todayItem.weather[0].description,
                icon: todayItem.weather[0].icon
            },
            days: daysArray.slice(1, 3) // Следующие 2 дня
        };
    }

    renderMainForecast(data) {
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
                        <div class="temp">${day.temp_min}° / ${day.temp_max}°</div>
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
            container.innerHTML = '<p style="text-align: center; color: rgba(255,255,255,0.7);">Добавьте города для просмотра прогноза</p>';
            return;
        }

        container.innerHTML = `
            <div class="city-tabs" style="margin-bottom: 20px;">
                ${this.cities.map((city, index) => 
                    `<button class="city-tab ${index === 0 ? 'active' : ''}" data-index="${index}">
                        ${city.name}
                    </button>`
                ).join('')}
            </div>
            <div class="weather-section">
                ${this.cities.map((city, index) => `
                    <div class="city-forecast ${index === 0 ? '' : 'hidden'}" data-city="${index}">
                        <div class="weather-header">
                            <h2>${city.name}</h2>
                            <span class="status success">✓</span>
                        </div>
                        <div class="weather-content">
                            <div class="forecast-grid">
                                <div class="forecast-day">
                                    <div class="day-icon">🎄</div>
                                    <div class="temp">${city.today?.temp || '--'}°</div>
                                    <div class="description">${city.today?.description || 'Загрузка...'}</div>
                                    <div class="date">Сегодня</div>
                                </div>
                                ${city.days?.map(day => `
                                    <div class="forecast-day">
                                        <div class="day-icon">❄️</div>
                                        <div class="temp">${day.temp_min}° / ${day.temp_max}°</div>
                                        <div class="description">${day.description}</div>
                                        <div class="date">${this.formatDate(day.date)}</div>
                                    </div>
                                `).join('') || ''}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        // Вкладки
        document.querySelectorAll('.city-tab').forEach((tab, index) => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.city-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.city-forecast').forEach(f => f.classList.add('hidden'));
                tab.classList.add('active');
                document.querySelector(`[data-city="${index}"]`).classList.remove('hidden');
            });
        });
    }

    setMainStatus(status) {
        const statusEl = document.getElementById('mainStatus');
        const contentEl = document.getElementById('mainContent');
        
        if (status === 'loading') {
            statusEl.textContent = '⏳ Загрузка...';
            statusEl.className = 'status loading';
            contentEl.className = 'weather-content loading';
        } else if (status === 'success') {
            statusEl.textContent = '✨ Готово!';
            statusEl.className = 'status success';
            contentEl.className = 'weather-content';
        } else {
            statusEl.textContent = '❌ Ошибка';
            statusEl.className = 'status error';
            contentEl.className = 'weather-content error';
            contentEl.innerHTML = 'Не удалось загрузить прогноз. Проверьте API ключ.';
        }
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

// Запуск
const app = new WeatherApp();
window.app = app;
