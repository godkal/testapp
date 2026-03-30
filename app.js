const STORAGE_KEYS = {
  defaultPrepMinutes: "defaultPrepMinutes",
  defaultBufferMinutes: "defaultBufferMinutes",
  recentTravelMinutes: "recentTravelMinutes",
  alertsEnabledSound: "alertsEnabledSound",
  alertsEnabledVibration: "alertsEnabledVibration",
  specVersion: "specVersion",
};

const PREP_WARNING_MINUTES = 5;

const els = {
  nowTime: document.getElementById("nowTime"),
  statusBadge: document.getElementById("statusBadge"),
  hero: document.getElementById("hero"),
  statusMessage: document.getElementById("statusMessage"),
  statusSubMessage: document.getElementById("statusSubMessage"),
  targetArrivalTime: document.getElementById("targetArrivalTime"),
  travelMinutes: document.getElementById("travelMinutes"),
  bufferMinutes: document.getElementById("bufferMinutes"),
  prepMinutes: document.getElementById("prepMinutes"),
  prepStartTime: document.getElementById("prepStartTime"),
  leaveTime: document.getElementById("leaveTime"),
  targetDisplay: document.getElementById("targetDisplay"),
  timeUntilPrepStart: document.getElementById("timeUntilPrepStart"),
  timeUntilLeave: document.getElementById("timeUntilLeave"),
  timelineNow: document.getElementById("timelineNow"),
  timelinePrep: document.getElementById("timelinePrep"),
  timelineLeave: document.getElementById("timelineLeave"),
  timelineTarget: document.getElementById("timelineTarget"),
  formulaText: document.getElementById("formulaText"),
  detailSection: document.getElementById("detailSection"),
  toggleDetail: document.getElementById("toggleDetail"),
  defaultPrepMinutes: document.getElementById("defaultPrepMinutes"),
  defaultBufferMinutes: document.getElementById("defaultBufferMinutes"),
  soundEnabled: document.getElementById("soundEnabled"),
  vibrationEnabled: document.getElementById("vibrationEnabled"),
  saveDefaultsBtn: document.getElementById("saveDefaultsBtn"),
};

let appState = {
  currentStatus: "waiting",
  lastAlertedStatus: null,
};

function toNonNegativeInt(value) {
  if (value === "" || value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

function formatTime(date) {
  if (!(date instanceof Date)) return "--:--";
  return date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatClock(date) {
  if (!(date instanceof Date)) return "--:--:--";
  return date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return "--:--:--";
  const sign = seconds < 0 ? "-" : "";
  const abs = Math.abs(Math.floor(seconds));
  const h = String(Math.floor(abs / 3600)).padStart(2, "0");
  const m = String(Math.floor((abs % 3600) / 60)).padStart(2, "0");
  const s = String(abs % 60).padStart(2, "0");
  return `${sign}${h}:${m}:${s}`;
}

function parseTargetDate(today, targetTimeValue) {
  if (!targetTimeValue) return null;
  const [h, m] = targetTimeValue.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const target = new Date(today);
  target.setHours(h, m, 0, 0);
  if (target.getTime() < today.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target;
}

function computeModel(now, input) {
  const targetArrival = parseTargetDate(now, input.targetArrivalTime);
  const travel = toNonNegativeInt(input.travelMinutes);
  const buffer = toNonNegativeInt(input.bufferMinutes);
  const prep = toNonNegativeInt(input.prepMinutes);

  if (!targetArrival || travel == null || buffer == null || prep == null) {
    return { valid: false };
  }

  const leave = new Date(targetArrival.getTime() - (buffer + travel) * 60 * 1000);
  const prepStart = new Date(leave.getTime() - prep * 60 * 1000);

  const secondsUntilPrepStart = Math.floor((prepStart.getTime() - now.getTime()) / 1000);
  const secondsUntilLeave = Math.floor((leave.getTime() - now.getTime()) / 1000);
  const secondsUntilTarget = Math.floor((targetArrival.getTime() - now.getTime()) / 1000);

  let status = "waiting";
  if (now.getTime() >= targetArrival.getTime()) {
    status = "late";
  } else if (now.getTime() >= leave.getTime()) {
    status = "leave";
  } else if (now.getTime() >= prepStart.getTime()) {
    status = "prep";
  } else if (secondsUntilPrepStart <= PREP_WARNING_MINUTES * 60) {
    status = "prep_soon";
  }

  return {
    valid: true,
    targetArrival,
    leave,
    prepStart,
    secondsUntilPrepStart,
    secondsUntilLeave,
    secondsUntilTarget,
    status,
    travel,
    buffer,
    prep,
  };
}

function statusLabel(status) {
  switch (status) {
    case "prep_soon":
      return "준비 임박";
    case "prep":
      return "준비";
    case "leave":
      return "출발";
    case "late":
      return "지각";
    default:
      return "대기";
  }
}

function statusMessage(model) {
  if (!model.valid) {
    return {
      main: "도착 시각과 분 단위 시간을 입력하세요",
      sub: "입력값을 바꾸면 결과가 바로 업데이트됩니다.",
    };
  }

  switch (model.status) {
    case "prep_soon":
      return {
        main: "곧 준비를 시작해야 해요",
        sub: `준비 시작까지 ${Math.max(0, Math.ceil(model.secondsUntilPrepStart / 60))}분 남았습니다.`,
      };
    case "prep":
      return {
        main: "지금 준비를 시작해야 합니다",
        sub: `출발까지 ${Math.max(0, Math.ceil(model.secondsUntilLeave / 60))}분 남았습니다.`,
      };
    case "leave": {
      const expectedArrivalMillis = Date.now() + model.travel * 60 * 1000;
      const lateBy = Math.max(0, Math.ceil((expectedArrivalMillis - model.targetArrival.getTime()) / 60000));
      return {
        main: "지금 출발해야 합니다",
        sub: `현재 기준 지각 예상 ${lateBy}분`,
      };
    }
    case "late": {
      const delayed = Math.max(0, Math.ceil(-model.secondsUntilTarget / 60));
      return {
        main: "이미 목표 도착 시각이 지났습니다. 즉시 이동하세요",
        sub: `현재 지연 ${delayed}분`,
      };
    }
    default:
      return {
        main: `준비 시작까지 ${Math.max(0, Math.ceil(model.secondsUntilPrepStart / 60))}분 남았어요`,
        sub: "필요하면 지금 미리 준비를 시작해도 좋습니다.",
      };
  }
}

function supportsVibration() {
  return "vibrate" in navigator;
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.03;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch (_) {
    // 브라우저 정책으로 실패해도 UI 흐름 유지
  }
}

function runAlerts(status) {
  if (appState.lastAlertedStatus === status) return;
  if (status !== "prep_soon" && status !== "leave" && status !== "late") return;

  if (els.soundEnabled.checked) {
    playBeep();
  }

  if (els.vibrationEnabled.checked && supportsVibration()) {
    navigator.vibrate([120, 80, 120]);
  }

  appState.lastAlertedStatus = status;
}

function resetAlertGuard(status) {
  if (status === "waiting" || status === "prep") {
    appState.lastAlertedStatus = null;
  }
}

function setStatusClass(status) {
  const statuses = ["waiting", "prep_soon", "prep", "leave", "late"];
  els.hero.classList.remove(...statuses);
  els.statusBadge.classList.remove(...statuses);
  els.hero.classList.add(status);
  els.statusBadge.classList.add(status);
  els.statusBadge.textContent = statusLabel(status);
}

function updateUI() {
  const now = new Date();
  els.nowTime.textContent = formatClock(now);
  els.timelineNow.textContent = formatTime(now);

  const input = {
    targetArrivalTime: els.targetArrivalTime.value,
    travelMinutes: els.travelMinutes.value,
    bufferMinutes: els.bufferMinutes.value,
    prepMinutes: els.prepMinutes.value,
  };

  const model = computeModel(now, input);
  const msg = statusMessage(model);
  els.statusMessage.textContent = msg.main;
  els.statusSubMessage.textContent = msg.sub;

  if (!model.valid) {
    setStatusClass("waiting");
    els.prepStartTime.textContent = "--:--";
    els.leaveTime.textContent = "--:--";
    els.targetDisplay.textContent = "--:--";
    els.timeUntilPrepStart.textContent = "--:--:--";
    els.timeUntilLeave.textContent = "--:--:--";
    els.timelinePrep.textContent = "--:--";
    els.timelineLeave.textContent = "--:--";
    els.timelineTarget.textContent = "--:--";
    els.formulaText.textContent = "공식: 준비 시작 = 도착 목표 - 여유 - 이동 - 준비";
    return;
  }

  setStatusClass(model.status);
  resetAlertGuard(model.status);
  runAlerts(model.status);

  els.prepStartTime.textContent = formatTime(model.prepStart);
  els.leaveTime.textContent = formatTime(model.leave);
  els.targetDisplay.textContent = formatTime(model.targetArrival);
  els.timeUntilPrepStart.textContent = formatDuration(model.secondsUntilPrepStart);
  els.timeUntilLeave.textContent = formatDuration(model.secondsUntilLeave);
  els.timelinePrep.textContent = formatTime(model.prepStart);
  els.timelineLeave.textContent = formatTime(model.leave);
  els.timelineTarget.textContent = formatTime(model.targetArrival);
  els.formulaText.textContent = `공식: ${formatTime(model.targetArrival)} - 여유 ${model.buffer}분 - 이동 ${model.travel}분 - 준비 ${model.prep}분 = 준비 시작 ${formatTime(model.prepStart)}`;
}

function saveStorage() {
  localStorage.setItem(STORAGE_KEYS.specVersion, "v1");
  localStorage.setItem(STORAGE_KEYS.defaultPrepMinutes, String(toNonNegativeInt(els.defaultPrepMinutes.value) ?? 30));
  localStorage.setItem(STORAGE_KEYS.defaultBufferMinutes, String(toNonNegativeInt(els.defaultBufferMinutes.value) ?? 15));

  const travel = toNonNegativeInt(els.travelMinutes.value);
  if (travel != null) {
    localStorage.setItem(STORAGE_KEYS.recentTravelMinutes, String(travel));
  }

  localStorage.setItem(STORAGE_KEYS.alertsEnabledSound, String(els.soundEnabled.checked));
  localStorage.setItem(STORAGE_KEYS.alertsEnabledVibration, String(els.vibrationEnabled.checked));
}

function loadStorage() {
  const defaultPrep = toNonNegativeInt(localStorage.getItem(STORAGE_KEYS.defaultPrepMinutes));
  const defaultBuffer = toNonNegativeInt(localStorage.getItem(STORAGE_KEYS.defaultBufferMinutes));
  const recentTravel = toNonNegativeInt(localStorage.getItem(STORAGE_KEYS.recentTravelMinutes));
  const sound = localStorage.getItem(STORAGE_KEYS.alertsEnabledSound) === "true";
  const vibration = localStorage.getItem(STORAGE_KEYS.alertsEnabledVibration) === "true";

  const prep = defaultPrep ?? 30;
  const buffer = defaultBuffer ?? 15;

  els.defaultPrepMinutes.value = String(prep);
  els.defaultBufferMinutes.value = String(buffer);
  els.prepMinutes.value = String(prep);
  els.bufferMinutes.value = String(buffer);
  els.travelMinutes.value = recentTravel == null ? "" : String(recentTravel);
  els.soundEnabled.checked = sound;
  els.vibrationEnabled.checked = vibration;
}

function wireEvents() {
  const inputs = [els.targetArrivalTime, els.travelMinutes, els.bufferMinutes, els.prepMinutes];
  for (const input of inputs) {
    input.addEventListener("input", () => {
      updateUI();
      saveStorage();
    });
  }

  for (const btn of document.querySelectorAll(".preset-btn")) {
    btn.addEventListener("click", () => {
      const m = btn.getAttribute("data-minutes");
      els.prepMinutes.value = m;
      updateUI();
      saveStorage();
    });
  }

  els.saveDefaultsBtn.addEventListener("click", () => {
    const prep = toNonNegativeInt(els.defaultPrepMinutes.value) ?? 30;
    const buffer = toNonNegativeInt(els.defaultBufferMinutes.value) ?? 15;
    els.prepMinutes.value = String(prep);
    els.bufferMinutes.value = String(buffer);
    saveStorage();
    updateUI();
  });

  els.soundEnabled.addEventListener("change", saveStorage);
  els.vibrationEnabled.addEventListener("change", saveStorage);

  els.toggleDetail.addEventListener("click", () => {
    const isHidden = els.detailSection.classList.toggle("hidden");
    els.toggleDetail.setAttribute("aria-expanded", String(!isHidden));
    els.toggleDetail.textContent = isHidden ? "상세 보기 ▼" : "상세 닫기 ▲";
  });
}

function init() {
  loadStorage();
  wireEvents();
  updateUI();
  setInterval(updateUI, 1000);
}

init();
