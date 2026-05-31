// Общий координатор автообновления графиков.
//
// Раньше каждый узел-график держал собственный setInterval и слал по одному
// fetch на каждую линию. При нескольких графиках это давало десятки запросов
// каждые 20 мс и перегружало сервер. Теперь все графики с включённым
// автообновлением подписываются на этот координатор. Один общий таймер
// собирает запросы со всех «созревших» подписчиков, объединяет одинаковые SQL,
// отправляет ОДИН пакетный запрос на /api/execute-batch и раздаёт результаты
// обратно каждому графику.

const API_BASE_URL = 'http://localhost:8080/api';
const DEFAULT_INTERVAL = 20;

// nodeId -> { getInterval, getQueries, onResults, lastRun }
const subscribers = new Map();

let timer = null;
let timerPeriod = null;
let inFlight = false;

function computePeriod() {
  let min = Infinity;
  subscribers.forEach((sub) => {
    const interval = Number(sub.getInterval()) || DEFAULT_INTERVAL;
    if (interval < min) min = interval;
  });
  return min === Infinity ? DEFAULT_INTERVAL : Math.max(1, min);
}

function ensureTimer() {
  const period = computePeriod();
  if (timer && timerPeriod === period) return;
  if (timer) clearInterval(timer);
  timerPeriod = period;
  timer = setInterval(tick, period);
}

function stopTimer() {
  if (timer) clearInterval(timer);
  timer = null;
  timerPeriod = null;
}

async function tick() {
  // Защита от наложения: если прошлый пакет ещё не вернулся, пропускаем тик.
  if (inFlight) return;

  const now = Date.now();

  // Собираем запросы только с тех подписчиков, у которых истёк их интервал.
  const dueNodeIds = [];
  const sqlToKeys = new Map(); // sql -> [key, ...]
  const keyToNode = new Map(); // key -> nodeId

  subscribers.forEach((sub, nodeId) => {
    const interval = Number(sub.getInterval()) || DEFAULT_INTERVAL;
    if (now - sub.lastRun < interval) return;

    let queries;
    try {
      queries = sub.getQueries() || [];
    } catch {
      queries = [];
    }
    if (queries.length === 0) return;

    dueNodeIds.push(nodeId);
    queries.forEach(({ key, sql }) => {
      if (!key || !sql) return;
      keyToNode.set(key, nodeId);
      if (!sqlToKeys.has(sql)) sqlToKeys.set(sql, []);
      sqlToKeys.get(sql).push(key);
    });
  });

  if (sqlToKeys.size === 0) return;

  // Помечаем созревших как обновлённых, чтобы их интервал считался от now.
  dueNodeIds.forEach((nodeId) => {
    const sub = subscribers.get(nodeId);
    if (sub) sub.lastRun = now;
  });

  // Дедупликация: каждый уникальный SQL уходит на сервер один раз.
  const uniqueSqls = [...sqlToKeys.keys()];
  const batch = uniqueSqls.map((sql, i) => ({ id: String(i), sql }));

  inFlight = true;
  try {
    const response = await fetch(`${API_BASE_URL}/execute-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queries: batch }),
    });

    if (!response.ok) throw new Error('Ошибка пакетного запроса');

    const payload = await response.json();
    const results = payload.results || {};

    // Разворачиваем результаты: id пакета -> rows -> все ключи с этим SQL.
    const rowsByKey = {}; // key -> rows
    batch.forEach(({ id, sql }) => {
      const entry = results[id];
      const rows = entry && entry.data ? entry.data : [];
      sqlToKeys.get(sql).forEach((key) => {
        rowsByKey[key] = rows;
      });
    });

    // Группируем по узлам и отдаём каждому только его ключи.
    const byNode = new Map(); // nodeId -> { key: rows }
    Object.keys(rowsByKey).forEach((key) => {
      const nodeId = keyToNode.get(key);
      if (!nodeId) return;
      if (!byNode.has(nodeId)) byNode.set(nodeId, {});
      byNode.get(nodeId)[key] = rowsByKey[key];
    });

    byNode.forEach((nodeRows, nodeId) => {
      const sub = subscribers.get(nodeId);
      if (!sub) return;
      try {
        sub.onResults(nodeRows);
      } catch (err) {
        console.error('Ошибка обработки результатов автообновления:', err);
      }
    });
  } catch (err) {
    console.error('Ошибка пакетного автообновления:', err);
  } finally {
    inFlight = false;
  }
}

export function subscribe(nodeId, { getInterval, getQueries, onResults }) {
  subscribers.set(nodeId, {
    getInterval: getInterval || (() => DEFAULT_INTERVAL),
    getQueries,
    onResults,
    lastRun: 0, // 0 => первый тик обновит сразу
  });
  ensureTimer();
}

export function unsubscribe(nodeId) {
  subscribers.delete(nodeId);
  if (subscribers.size === 0) {
    stopTimer();
  } else {
    ensureTimer();
  }
}

// Пересчитать период общего таймера. Вызывается, когда подписчик меняет свой
// интервал на лету: период таймера = минимум интервалов всех подписчиков, и
// при уменьшении интервала его нужно пересоздать с меньшим периодом.
export function refresh() {
  if (subscribers.size > 0) ensureTimer();
}
