const briefingBtn = document.getElementById('briefingBtn');
const installBtn = document.getElementById('installBtn');
const statusEl = document.getElementById('status');
const resultCard = document.getElementById('resultCard');
const headlineEl = document.getElementById('headline');
const detailsEl = document.getElementById('details');
const updatedAtEl = document.getElementById('updatedAt');
const historyEl = document.getElementById('history');
const locationTextEl = document.getElementById('locationText');
const coordTextEl = document.getElementById('coordText');
const tempValueEl = document.getElementById('tempValue');
const rainValueEl = document.getElementById('rainValue');
const pmValueEl = document.getElementById('pmValue');

const STORAGE_KEY = 'commute_briefings_v2';
let deferredPrompt = null;

function setStatus(message) {
  statusEl.textContent = message;
}

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveHistory(item) {
  const history = getHistory();
  history.unshift(item);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 7)));
}

function renderHistory() {
  const history = getHistory();
  historyEl.innerHTML = '';

  if (!history.length) {
    const li = document.createElement('li');
    li.textContent = '최근 기록이 없습니다.';
    historyEl.appendChild(li);
    return;
  }

  history.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = `${new Date(item.ts).toLocaleString('ko-KR')} - ${item.headline}`;
    historyEl.appendChild(li);
  });
}

function levelClass(type, value) {
  if (type === 'pm') {
    if (value >= 75) return 'badge-bad';
    if (value >= 35) return 'badge-warn';
    return 'badge-ok';
  }

  if (value >= 60) return 'badge-bad';
  if (value >= 30) return 'badge-warn';
  return 'badge-ok';
}

function pmLabel(value) {
  if (value >= 75) return '나쁨';
  if (value >= 35) return '보통';
  return '좋음';
}

function weatherLabel(code) {
  const map = {
    0: '맑음',
    1: '대체로 맑음',
    2: '구름 조금',
    3: '흐림',
    45: '안개',
    48: '짙은 안개',
    51: '약한 이슬비',
    53: '이슬비',
    55: '강한 이슬비',
    61: '약한 비',
    63: '비',
    65: '강한 비',
    71: '약한 눈',
    73: '눈',
    75: '강한 눈',
    80: '약한 소나기',
    81: '소나기',
    82: '강한 소나기',
    95: '뇌우',
  };
  return map[code] || '날씨 정보';
}

function updateMood(weatherCode, feelsLike) {
  const body = document.body;
  if ([61, 63, 65, 80, 81, 82, 51, 53, 55].includes(weatherCode)) {
    body.dataset.mood = 'rain';
    return;
  }
  if (feelsLike >= 29) {
    body.dataset.mood = 'hot';
    return;
  }
  body.dataset.mood = 'clear';
}

function makeHeadline(data) {
  const umbrella = data.maxRain3h >= 40 ? '우산 챙기기' : '우산은 선택';
  const air = data.pm25 >= 35 ? '마스크 권장' : '대기질 무난';
  const clothes = data.feelsLike <= 2 ? '두꺼운 외투' : data.feelsLike >= 27 ? '가벼운 반팔' : '가벼운 겉옷';
  return `${umbrella} · ${air} · ${clothes}`;
}

function nowHourIsoLocal() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:00`;
}

function nearestHourIndex(times) {
  const key = nowHourIsoLocal();
  const exact = times.indexOf(key);
  if (exact >= 0) return exact;

  const now = Date.now();
  let bestIdx = 0;
  let bestDiff = Number.MAX_SAFE_INTEGER;

  for (let i = 0; i < times.length; i += 1) {
    const diff = Math.abs(new Date(times[i]).getTime() - now);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = i;
    }
  }

  return bestIdx;
}

async function getCurrentPosition() {
  if (!navigator.geolocation) {
    throw new Error('브라우저 위치 기능을 지원하지 않습니다.');
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 120000,
    });
  });
}

async function fetchLocationName(lat, lon) {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=ko`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('reverse geocode 실패');
    const json = await res.json();
    const city = json.city || json.locality || json.principalSubdivision || '현재 위치';
    const region = json.principalSubdivision ? `, ${json.principalSubdivision}` : '';
    return `${city}${region}`;
  } catch {
    return `위도 ${lat.toFixed(3)}, 경도 ${lon.toFixed(3)}`;
  }
}

async function fetchWeatherAndAir(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=apparent_temperature,precipitation_probability,pm2_5&current=temperature_2m,apparent_temperature,precipitation,weather_code&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('날씨 데이터를 불러오지 못했습니다.');
  }

  const json = await res.json();
  const times = json.hourly?.time || [];
  const idx = nearestHourIndex(times);
  const rainSeries = json.hourly?.precipitation_probability || [];
  const maxRain3h = Math.max(...rainSeries.slice(idx, idx + 3), 0);
  const pm25 = Number(json.hourly?.pm2_5?.[idx] ?? 0);
  const feelsLike = Number(json.current?.apparent_temperature ?? json.hourly?.apparent_temperature?.[idx] ?? 0);
  const weatherCode = Number(json.current?.weather_code ?? 0);

  return {
    feelsLike,
    pm25,
    maxRain3h,
    weatherCode,
    weatherText: weatherLabel(weatherCode),
  };
}

function renderBriefing(data, locationName, lat, lon) {
  const headline = makeHeadline(data);
  const pmState = pmLabel(data.pm25);

  updateMood(data.weatherCode, data.feelsLike);

  locationTextEl.textContent = locationName;
  coordTextEl.textContent = `${lat.toFixed(3)}, ${lon.toFixed(3)}`;

  tempValueEl.textContent = `${data.feelsLike.toFixed(1)}°C`;
  rainValueEl.innerHTML = `<span class="${levelClass('rain', data.maxRain3h)}">${data.maxRain3h.toFixed(0)}%</span>`;
  pmValueEl.innerHTML = `<span class="${levelClass('pm', data.pm25)}">${data.pm25.toFixed(1)} (${pmState})</span>`;

  headlineEl.textContent = headline;

  detailsEl.innerHTML = '';
  const lines = [
    `현재 위치: ${locationName}`,
    `현재 날씨: ${data.weatherText}`,
    `3시간 내 최대 강수확률: ${data.maxRain3h.toFixed(0)}%`,
    `미세먼지 PM2.5: ${data.pm25.toFixed(1)} µg/m³ (${pmState})`,
  ];

  lines.forEach((line) => {
    const li = document.createElement('li');
    li.textContent = line;
    detailsEl.appendChild(li);
  });

  updatedAtEl.textContent = `업데이트 ${new Date().toLocaleString('ko-KR')}`;
  resultCard.hidden = false;

  saveHistory({ ts: Date.now(), headline });
  renderHistory();
}

async function createBriefing() {
  briefingBtn.disabled = true;
  setStatus('현재 위치와 실시간 데이터를 조회 중입니다...');

  try {
    const pos = await getCurrentPosition();
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;

    const [locationName, weather] = await Promise.all([
      fetchLocationName(lat, lon),
      fetchWeatherAndAir(lat, lon),
    ]);

    renderBriefing(weather, locationName, lat, lon);
    setStatus('최신 브리핑 반영 완료. 홈 화면에 추가하면 앱처럼 쓸 수 있어요.');
  } catch (error) {
    console.error(error);
    setStatus(`오류: ${error.message}`);
  } finally {
    briefingBtn.disabled = false;
  }
}

async function autoRefreshIfAllowed() {
  try {
    if (!navigator.permissions?.query) return;
    const permission = await navigator.permissions.query({ name: 'geolocation' });
    if (permission.state === 'granted') {
      createBriefing();
    }
  } catch {
    // Ignore permission API failures and keep manual flow.
  }
}

briefingBtn.addEventListener('click', createBriefing);

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event;
  installBtn.hidden = false;
});

installBtn.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.hidden = true;
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('./sw.js', { scope: './' });
    } catch (error) {
      console.error('Service Worker 등록 실패', error);
    }
  });
}

renderHistory();
autoRefreshIfAllowed();
