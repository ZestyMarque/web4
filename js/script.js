class WeatherApp {
    constructor() {
        this.API_KEY = 'f6aec960f0fcbdc574a2f22da749dd5c';
        this.baseUrl = 'https://api.openweathermap.org/data/2.5';

        this.cities = JSON.parse(localStorage.getItem('weatherCities')) || [];
        this.currentLocation = JSON.parse(localStorage.getItem('currentLocation')) || null;
        this.citySuggestions = [
            'Москва', 'Санкт-Петербург', 'Новосибирск', 'Екатеринбург', 'Казань',
            'Нижний Новгород', 'Челябинск', 'Самара', 'Омск', 'Ростов-на-Дону',
            'Красноярск', 'Воронеж', 'Пермь', 'Волгоград', 'Краснодар',
            'London', 'Paris', 'Berlin', 'Madrid', 'Rome', 'New York', 'Tokyo'
        ];

        this.init();
    }


    init() {
        this.bindEvents();

        if (this.currentLocation) {
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
        
        document.getElementById('cityInput').addEventListener('input', (e) => {
            this.showSuggestions(e.target.value);
        });
    }

    showSuggestions(query) {
        const datalist = document.getElementById('citySuggestions');
        datalist.innerHTML = ''; 

        if (!query || query.length < 2) return;

        // фильтр города из списка
        const filtered = this.citySuggestions
            .filter(city => city.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 6);

        filtered.forEach(city => {
            const option = document.createElement('option');
            option.value = city;
            datalist.appendChild(option);
        });
    }


    requestGeolocation() {
        const status = document.getElementById('mainStatus');
        status.textContent = '⏳ Запрашиваем геолокацию...';
        status.className = 'status loading';

        if (!navigator.geolocation) {
            this.showManualCityInput();
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                this.currentLocation = { lat: latitude, lon: longitude, type: 'geo' };
                localStorage.setItem('currentLocation', JSON.stringify(this.currentLocation));
                this.loadWeatherForCurrent();
            },
            () => {
                this.showManualCityInput();
            },
            { timeout: 10000, enableHighAccuracy: true }
        );
    }
    // ручной ввод
    showManualCityInput() {
        document.getElementById('mainTitle').textContent = 'Введите город';
        const status = document.getElementById('mainStatus');
        status.textContent = 'Ожидаем ввод города';
        status.className = 'status';

        const container = document.getElementById('mainContent');
        container.className = 'weather-content';
        container.innerHTML = `
            <div style="text-align:center;padding:40px;color:rgba(255,255,255,0.9);">
                <input type="text" id="initialCityInput" placeholder="Например: Санкт-Петербург"
                    style="padding:12px 16px;border-radius:12px;border:2px solid rgba(255,255,255,0.3);
                    font-size:1.05em;width:80%;max-width:350px;background:rgba(255,255,255,0.1);color:white;">
                <br><br>
                <button id="initialCityBtn"
                    style="background:linear-gradient(45deg,#ff6b6b,#feca57);color:white;border:none;
                    padding:10px 24px;border-radius:12px;cursor:pointer;font-size:1.05em;">
                    Показать погоду
                </button>
            </div>
        `;

        document.getElementById('initialCityBtn').addEventListener('click', () => this.addInitialCity());
    }

    async addInitialCity() {
        const input = document.getElementById('initialCityInput');
        const name = input.value.trim();
        if (!name) return;

        this.currentLocation = { name, type: 'manual' };
        localStorage.setItem('currentLocation', JSON.stringify(this.currentLocation));
        await this.loadWeatherForCurrent();
    }

    async loadWeatherForCurrent() {
        this.setMainStatus('loading');
        try {
            const data = await this.fetchWeatherForecast(this.currentLocation);
            this.currentLocation.cityName = data.city;
            localStorage.setItem('currentLocation', JSON.stringify(this.currentLocation));
            this.renderMainForecast(data);
            this.setMainStatus('success');
        } catch (e) {
            console.error('loadWeatherForCurrent error:', e);
            this.setMainStatus('error');
        }
    }


    async addCity() {
        const input = document.getElementById('cityInput');
        const name = input.value.trim();

        if (!name) {
            this.showCityError('Введите название города');
            return;
        }

        if (this.cities.some(c => c.name.toLowerCase() === name.toLowerCase())) {
            this.showCityError('Город уже есть в списке');
            return;
        }

        this.setCityInputStatus('loading');

        try {
            const data = await this.fetchWeatherForecast({ name });
            const cityData = { name: data.city, today: data.today, days: data.days };
            this.cities.push(cityData);
            this.saveCities();
            input.value = '';
            this.renderCitiesList();
            this.setCityInputStatus('success');
        } catch (e) {
            console.error('addCity error:', e);
            this.showCityError('Город не найден или произошла ошибка. Попробуйте ещё раз.');
            this.setCityInputStatus('error');
        }
    }

    deleteCity(index) {
        this.cities.splice(index, 1);
        this.saveCities();
        this.renderCitiesList();
    }


    async refreshAll() {
        this.setMainStatus('loading');
        try {
            await this.loadWeatherForCurrent();

            for (let i = 0; i < this.cities.length; i++) {
                try {
                    const data = await this.fetchWeatherForecast({ name: this.cities[i].name });
                    this.cities[i].today = data.today;
                    this.cities[i].days = data.days;
                } catch (e) {
                    console.error('refresh city error:', this.cities[i].name, e);
                }
            }
            this.saveCities();
            this.renderCitiesList();
        } finally {
            this.setMainStatus('success');
        }
    }

    async fetchWeatherForecast(location) {
        let url;
        if (location.lat !== undefined && location.lon !== undefined) {
            url = `${this.baseUrl}/forecast?lat=${location.lat}&lon=${location.lon}&units=metric&lang=ru&appid=${this.API_KEY}`;
        } else {
            url = `${this.baseUrl}/forecast?q=${encodeURIComponent(location.name)}&units=metric&lang=ru&appid=${this.API_KEY}`;
        }

        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`API error: ${res.status}`);
        }

        const data = await res.json();
        if (!data.list || data.list.length === 0) {
            throw new Error('Empty data from API');
        }

        return this.parseForecastData(data);
    }
    // преобразование данных
    parseForecastData(apiData) {
        const city = apiData.city?.name || 'Неизвестный город';

        const now = Date.now() / 1000;
        const todayItem = apiData.list.find(item => Math.abs(item.dt - now) < 10800) || apiData.list[0];

        const days = {};
        apiData.list.forEach(item => {
            const dateStr = item.dt_txt.split(' ')[0];
            if (!days[dateStr]) {
                days[dateStr] = { date: dateStr, temps: [], descriptions: [] };
            }
            days[dateStr].temps.push(item.main.temp);
            days[dateStr].descriptions.push(item.weather[0].description);
        });

        const daysArray = Object.values(days).map(d => ({
            date: d.date,
            temp_min: Math.round(Math.min(...d.temps)),
            temp_max: Math.round(Math.max(...d.temps)),
            description: d.descriptions[0]
        }));

        return {
            city,
            today: {
                temp: Math.round(todayItem.main.temp),
                description: todayItem.weather[0].description
            },
            days: daysArray.slice(1, 3)
        };
    }


    renderMainForecast(data) {
        const titleEl = document.getElementById('mainTitle');
        titleEl.textContent = `Текущее местоположение — ${data.city}`;

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
                ${data.days.map(d => `
                    <div class="forecast-day">
                        <div class="day-icon">❄️</div>
                        <div class="temp">${d.temp_min}° / ${d.temp_max}°</div>
                        <div class="description">${d.description}</div>
                        <div class="date">${this.formatDate(d.date)}</div>
                    </div>`).join('')}
            </div>
        `;
    }

    // вкладки
    
    renderCitiesList() {
        const container = document.getElementById('citiesList');

        if (this.cities.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:rgba(255,255,255,0.7);">Добавьте города для просмотра прогноза</p>';
            return;
        }

        const tabsHtml = this.cities.map((city, i) => `
            <button class="city-tab ${i === 0 ? 'active' : ''}" data-index="${i}">
                ${city.name}
            </button>`).join('');

        const forecastsHtml = this.cities.map((city, i) => `
            <div class="city-forecast ${i === 0 ? '' : 'hidden'}" data-city="${i}">
                <div class="weather-header">
                    <h2>${city.name}</h2>
                    <button class="delete-city-btn" data-index="${i}">Удалить</button>
                </div>
                <div class="weather-content">
                    <div class="forecast-grid">
                        <div class="forecast-day">
                            <div class="day-icon">🎄</div>
                            <div class="temp">${city.today?.temp ?? '--'}°</div>
                            <div class="description">${city.today?.description ?? 'Загрузка...'}</div>
                            <div class="date">Сегодня</div>
                        </div>
                        ${city.days?.map(d => `
                            <div class="forecast-day">
                                <div class="day-icon">❄️</div>
                                <div class="temp">${d.temp_min}° / ${d.temp_max}°</div>
                                <div class="description">${d.description}</div>
                                <div class="date">${this.formatDate(d.date)}</div>
                            </div>`).join('') || ''}
                    </div>
                </div>
            </div>`).join('');

        container.innerHTML = `
            <div class="city-tabs">${tabsHtml}</div>
            <div class="weather-section">${forecastsHtml}</div>
        `;

        document.querySelectorAll('.city-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const index = Number(tab.dataset.index);
                document.querySelectorAll('.city-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.city-forecast').forEach(f => f.classList.add('hidden'));
                tab.classList.add('active');
                document.querySelector(`.city-forecast[data-city="${index}"]`).classList.remove('hidden');
            });
        });

        document.querySelectorAll('.delete-city-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = Number(btn.dataset.index);
                this.deleteCity(index);
            });
        });
    }


    setMainStatus(status) {
        const statusEl = document.getElementById('mainStatus');
        const contentEl = document.getElementById('mainContent');

        if (status === 'loading') {
            statusEl.textContent = '🎄 ⏳ Загружаем прогноз...';
            statusEl.className = 'status loading';
            contentEl.className = 'weather-content loading';
        } else if (status === 'success') {
            statusEl.textContent = '✨ Готово';
            statusEl.className = 'status success';
            contentEl.className = 'weather-content';
        } else if (status === 'error') {
            statusEl.textContent = '❌ Ошибка';
            statusEl.className = 'status error';
            contentEl.className = 'weather-content error';
        }
    }

    showCityError(message) {
        const el = document.getElementById('cityError');
        el.textContent = `❌ ${message}`;
        el.classList.remove('hidden');
    }

    setCityInputStatus(status) {
        const el = document.getElementById('cityError');
        if (status === 'loading') {
            el.textContent = '⏳ Проверяем город...';
            el.classList.remove('hidden');
        } else if (status === 'success') {
            el.textContent = '✅ Город добавлен';
            setTimeout(() => el.classList.add('hidden'), 1500);
        }
    }

    formatDate(dateStr) {
        const d = new Date(dateStr);
        const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
        return days[d.getDay()];
    }

    saveCities() {
        localStorage.setItem('weatherCities', JSON.stringify(this.cities));
    }
}

const app = new WeatherApp();
window.app = app;
