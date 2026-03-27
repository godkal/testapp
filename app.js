const briefingBtn = document.getElementById('briefingBtn');
const installBtn = document.getElementById('installBtn');
const statusEl = document.getElementById('status');
const resultCard = document.getElementById('resultCard');
const headlineEl = document.getElementById('headline');
const detailsEl = document.getElementById('details');
const updatedAtEl = document.getElementById('updatedAt');
const historyEl = document.getElementById('history');

let deferredPrompt = null;

const STORAGE_KEY = 'commute_briefings_v1';

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
    li.textContent = '아직 브리핑 기록이 없어요.';
    historyEl.appendChild(li);
    return;
  }

  history.forEach((item) => {
    const li = document.createElement('li');
    const date = new Date(item.ts).toLocaleString('ko-KR');
    li.textContent = `${date} - ${item.headline}`;
    historyEl.appendChild(li);
  });
}

function classifyRain(probability) {
  if (probability >= 60) return 'tag-bad';
  if (probability >= 30) return 'tag-warn';
  return 'tag-good';
}

function classifyPm(pm25) {
  if (pm25 >= 75) return 'tag-bad';
  if (pm25 >= 35) return 'tag-warn';
  return 'tag-good';
}

function makeHeadline({ rainProb, pm25, feelsLike }) {
  const umbrella = rainProb >= 40 ? '우산 챙기기' : '우산 불필요';
  const air = pm25 >= 35 ? '마스크 권장' : '대기질 양호';
  const temp = feelsLike <= 2 ? '두꺼운 외투 추천' : feelsLike >= 27 ? '가벼운 복장 추천' : '가벼운 겉옷 추천';
  return `${umbrella} | ${air} | ${temp}`;
}

async function getCurrentPosition() {
  if (!navigator.geolocation) {
    throw new Error('브라우저에서 위치 기능을 지원하지 않아요.');
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 5 * 60 * 1000,
    });
  });
}

async function fetchWeatherAndAir(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=apparent_temperature,precipitation_probability,pm2_5&current=temperature_2m,apparent_temperature,precipitation,weather_code&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('날씨 데이터를 가져오지 못했어요.');

  const json = await res.json();
  const hourIndex = 0;
  const rainProb = Number(json.hourly?.precipitation_probability?.[hourIndex] ?? 0);
  const feelsLike = Number(json.current?.apparent_temperature ?? json.hourly?.apparent_temperature?.[hourIndex] ?? 0);
  const pm25 = Number(json.hourly?.pm2_5?.[hourIndex] ?? 0);

  return { rainProb, feelsLike, pm25 };
}

function renderBriefing(data) {
  const headline = makeHeadline(data);

  headlineEl.textContent = headline;
  detailsEl.innerHTML = '';

  const rows = [
    { label: '강수 확률', value: `${data.rainProb}%`, cls: classifyRain(data.rainProb) },
    { label: '체감 온도', value: `${data.feelsLike.toFixed(1)}°C`, cls: 'tag-good' },
    { label: 'PM2.5', value: `${data.pm25.toFixed(1)} µg/m³`, cls: classifyPm(data.pm25) },
  ];

  rows.forEach((row) => {
    const li = document.createElement('li');
    li.innerHTML = `${row.label}: <span class="${row.cls}">${row.value}</span>`;
    detailsEl.appendChild(li);
  });

  updatedAtEl.textContent = `업데이트: ${new Date().toLocaleString('ko-KR')}`;
  resultCard.hidden = false;

  saveHistory({ ts: Date.now(), headline });
  renderHistory();
}

async function createBriefing() {
  briefingBtn.disabled = true;
  setStatus('위치와 날씨 데이터를 확인 중...');

  try {
    const pos = await getCurrentPosition();
    const { latitude, longitude } = pos.coords;
    const data = await fetchWeatherAndAir(latitude, longitude);
    renderBriefing(data);
    setStatus('브리핑 생성 완료. 홈 화면에 추가하면 앱처럼 쓸 수 있어요.');
  } catch (err) {
    console.error(err);
    setStatus(`실패: ${err.message}`);
  } finally {
    briefingBtn.disabled = false;
  }
}

briefingBtn.addEventListener('click', createBriefing);

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
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
    } catch (err) {
      console.error('SW 등록 실패', err);
    }
  });
}

renderHistory();
