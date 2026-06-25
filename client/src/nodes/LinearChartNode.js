import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import Chart from '../components/Chart';
import EditableTitle from './EditableTitle';
import CustomResizer from './CustomResizer';
import * as pollManager from '../services/pollManager';

// Парсит одну строку БД в точку графика { time(сек), value, originalTime }.
// Вынесено из applyResults, чтобы применять только к НОВЫМ строкам дельты.
const parseRow = (row, line) => {
  const xValue = row[line.xAxis];
  const rawY = row[line.yAxis];
  if (xValue == null || rawY == null) return null;

  const yValue = parseFloat(rawY);

  let timeValue;
  if (xValue instanceof Date) {
    timeValue = xValue.getTime() / 1000;
  } else if (typeof xValue === 'string') {
    const fullDateMatch = xValue.match(/\d{4}-\d{2}-\d{2}/);
    if (fullDateMatch) {
      const date = new Date(xValue);
      timeValue = !isNaN(date.getTime()) ? date.getTime() / 1000 : (parseFloat(xValue) || 0);
    } else {
      const timeMatch = xValue.match(/^(\d{1,2}):(\d{1,2}):(\d{1,2})(?:\.(\d+))?$/);
      if (timeMatch) {
        const hours = parseInt(timeMatch[1]) || 0;
        const minutes = parseInt(timeMatch[2]) || 0;
        const seconds = parseInt(timeMatch[3]) || 0;
        let milliseconds = 0;
        if (timeMatch[4]) {
          const msString = timeMatch[4].padEnd(3, '0').substring(0, 3);
          milliseconds = parseInt(msString, 10);
        }
        timeValue = hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
      } else {
        timeValue = parseFloat(xValue) || 0;
      }
    }
  } else {
    timeValue = parseFloat(xValue) || 0;
  }

  // originalTime храним сырым: он нужен как граница дельты (WHERE x > '...').
  return { time: timeValue, value: isNaN(yValue) ? 0 : yValue, originalTime: xValue };
};

// Длина окна relative в секундах.
const relativeWindowSeconds = (value, unit) => {
  const v = Math.max(1, parseInt(value, 10) || 1);
  const mult = unit === 'hours' ? 3600 : unit === 'minutes' ? 60 : 1;
  return v * mult;
};

const LinearChartNode = ({ data, isConnectable, selected, id, data_normal }) => {
  const { getNode, setNodes } = useReactFlow();
  const [chartData, setChartData] = useState([]);
  const [nodeSize, setNodeSize] = useState({ width: data.width || 600, height: data.height || 1200 });
  const [isResizing, setIsResizing] = useState(false);
  // Настройки обновления и окна данных. Поднимаются в node.data (data.updateConfig),
  // чтобы попадать в сохранённую конфигурацию полотна и восстанавливаться при импорте.
  // На монтировании сеем из data.updateConfig, но автообновление всегда стартует выключенным.
  const [updateConfig, setUpdateConfig] = useState(() => ({
    interval: 20,
    pointLimit: 200,
    lastUpdateTime: null,
    // Режим выбора окна данных:
    // 'points'   — последние N точек (LIMIT), ось X тянется за данными;
    // 'absolute' — фиксированное окно [rangeStart, rangeEnd] (WHERE BETWEEN);
    // 'relative' — последние N сек/мин/час, окно «едет» за NOW() (WHERE >= NOW()-INTERVAL).
    rangeMode: 'points',
    rangeStart: '',          // datetime-local строка для absolute
    rangeEnd: '',
    relativeValue: 60,       // число для relative
    relativeUnit: 'seconds', // 'seconds' | 'minutes' | 'hours'
    ...(data.updateConfig || {}),
    isAutoUpdate: false
  }));
  const [dataSourceInfo, setDataSourceInfo] = useState(null);
  const [yScaleMode, setYScaleMode] = useState('dynamic');
  // Черновые значения полей: применяются в updateConfig только по подтверждению.
  const [draftInterval, setDraftInterval] = useState(String(updateConfig.interval));
  const [draftPointLimit, setDraftPointLimit] = useState(String(updateConfig.pointLimit));
  const [draftRangeMode, setDraftRangeMode] = useState(updateConfig.rangeMode);
  const [draftRangeStart, setDraftRangeStart] = useState(updateConfig.rangeStart);
  const [draftRangeEnd, setDraftRangeEnd] = useState(updateConfig.rangeEnd);
  const [draftRelativeValue, setDraftRelativeValue] = useState(String(updateConfig.relativeValue));
  const [draftRelativeUnit, setDraftRelativeUnit] = useState(updateConfig.relativeUnit);
  const nodeRef = useRef(null);
  // Инкрементальное автообновление:
  // lastSeenRef — lineId -> сырая метка времени последней полученной точки (граница дельты);
  // bufferRef   — lineId -> накопленные распарсенные точки линии (окно уже обрезано);
  // liveLines   — живые данные для графика без прокачки через глобальное состояние React Flow.
  const lastSeenRef = useRef({});
  const bufferRef = useRef({});
  const [liveLines, setLiveLines] = useState(null);
  const persistAtRef = useRef(0); // время последнего сохранения буфера в node.data (троттл)
  const flushRef = useRef(null);  // последняя версия функции сохранения (для flush при размонтировании)

  // Сохраняет настройки обновления в node.data, чтобы они попали в конфигурацию полотна.
  const persistUpdateConfig = useCallback((cfg) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, updateConfig: cfg } } : node
      )
    );
  }, [id, setNodes]);

  // Применяет введённые интервал, лимит точек и параметры диапазона к настройкам графика.
  const applyUpdateSettings = useCallback(() => {
    const interval = Math.max(1, parseInt(draftInterval, 10) || 1);
    const pointLimit = Math.max(1, parseInt(draftPointLimit, 10) || 1);
    const relativeValue = Math.max(1, parseInt(draftRelativeValue, 10) || 1);
    setDraftInterval(String(interval));
    setDraftPointLimit(String(pointLimit));
    setDraftRelativeValue(String(relativeValue));
    const next = {
      ...updateConfig,
      interval,
      pointLimit,
      rangeMode: draftRangeMode,
      rangeStart: draftRangeStart,
      rangeEnd: draftRangeEnd,
      relativeValue,
      relativeUnit: draftRelativeUnit
    };
    setUpdateConfig(next);
    persistUpdateConfig(next);
  }, [updateConfig, draftInterval, draftPointLimit, draftRangeMode, draftRangeStart, draftRangeEnd, draftRelativeValue, draftRelativeUnit, persistUpdateConfig]);

  // Есть ли несохранённые изменения в полях (для подсветки кнопки подтверждения).
  const settingsDirty =
    String(updateConfig.interval) !== draftInterval ||
    String(updateConfig.pointLimit) !== draftPointLimit ||
    updateConfig.rangeMode !== draftRangeMode ||
    updateConfig.rangeStart !== draftRangeStart ||
    updateConfig.rangeEnd !== draftRangeEnd ||
    String(updateConfig.relativeValue) !== draftRelativeValue ||
    updateConfig.relativeUnit !== draftRelativeUnit;

  // Ключ линии в общем координаторе автообновления.
  const lineKey = useCallback((lineId) => `${id}:${lineId}`, [id]);

  // Строит SQL-запросы всех настроенных линий для пакетной отправки.
  // LIMIT берётся из настраиваемого лимита точек графика; в режимах диапазона
  // он работает как потолок числа точек, а WHERE ограничивает окно по времени.
  const getQueries = useCallback(() => {
    if (!data.lines || data.lines.length === 0) return [];
    const limit = updateConfig.pointLimit > 0 ? updateConfig.pointLimit : 200;
    const { rangeMode, rangeStart, rangeEnd, relativeValue, relativeUnit } = updateConfig;

    // Приводим datetime-local ('YYYY-MM-DDTHH:MM[:SS]') к wall-clock 'YYYY-MM-DD HH:MM:SS'
    // для подстановки в SQL (а не подставляем сырой ввод).
    const toSqlTimestamp = (s) => {
      if (!s) return null;
      let v = String(s).replace('T', ' ').trim();
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(v)) v += ':00';
      return v;
    };

    const norm = (sql) => sql.replace(/\s+/g, ' ').trim();

    return data.lines
      .filter(line => line.table && line.xAxis && line.yAxis)
      .map(line => {
        // только нужные колонки вместо SELECT *: меньше трафика и парсинга.
        // ORDER BY 1 = первая выбранная колонка (xAxis), порядок сохраняется.
        const cols = `${line.xAxis}, ${line.yAxis}`;
        const lastSeen = lastSeenRef.current[line.id];

        // absolute не оптимизируем дельтой — полная выборка фиксированного окна (как раньше).
        if (rangeMode === 'absolute') {
          const start = toSqlTimestamp(rangeStart);
          const end = toSqlTimestamp(rangeEnd);
          if (!start || !end) return null; // диапазон не задан — линию не запрашиваем
          return {
            key: lineKey(line.id),
            sql: norm(`SELECT ${cols} FROM ${line.table} WHERE ${line.xAxis} BETWEEN '${start}' AND '${end}' ORDER BY 1 ASC`)
          };
        }

        // Дельта: после первой загрузки тянем только строки новее последней виденной.
        // Левый край окна (points/relative) обрезает буфер на клиенте — см. applyResults.
        if (lastSeen != null) {
          return {
            key: lineKey(line.id),
            sql: norm(`SELECT ${cols} FROM ${line.table} WHERE ${line.xAxis} > '${lastSeen}' ORDER BY 1 ASC`)
          };
        }

        // Первая загрузка (буфер пуст).
        if (rangeMode === 'relative') {
          const value = Math.max(1, parseInt(relativeValue, 10) || 1);
          const unit = ['seconds', 'minutes', 'hours'].includes(relativeUnit) ? relativeUnit : 'seconds';
          return {
            key: lineKey(line.id),
            sql: norm(`SELECT ${cols} FROM ${line.table} WHERE ${line.xAxis} >= NOW() - INTERVAL '${value} ${unit}' ORDER BY 1 ASC`)
          };
        }
        // points: последние N точек.
        return {
          key: lineKey(line.id),
          sql: norm(`SELECT ${cols} FROM ${line.table} ORDER BY 1 DESC LIMIT ${limit}`)
        };
      })
      .filter(Boolean);
  }, [data.lines, lineKey, updateConfig]);

  // Сохраняет накопленный буфер в node.data (чтобы он попал в сохранённую
  // конфигурацию полотна). Это вызывает реконсиляцию React Flow, поэтому
  // делается троттлингом (не на каждый тик) и финальным flush при стопе/размонтировании.
  const persistLinesToNode = useCallback(() => {
    const hasData = (data.lines || []).some(l => (bufferRef.current[l.id] || []).length > 0);
    if (!hasData) return;
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id && node.type === 'linearChartNode') {
          const updatedLines = (node.data.lines || []).map(l => ({
            ...l,
            data: bufferRef.current[l.id] || l.data || []
          }));
          return { ...node, data: { ...node.data, lines: updatedLines, updateTimestamp: Date.now() } };
        }
        return node;
      })
    );
  }, [id, setNodes, data.lines]);

  // держим последнюю версию flush для вызова при размонтировании
  useEffect(() => { flushRef.current = persistLinesToNode; });

  // Принимает строки пакетного ответа и ИНКРЕМЕНТАЛЬНО обновляет буфер линий:
  // парсит только новые строки дельты, дописывает и обрезает окно. Живые данные
  // отдаются графику через liveLines, минуя глобальное состояние React Flow.
  const applyResults = useCallback((rowsByKey) => {
    if (!data.lines || data.lines.length === 0) return;
    const { rangeMode, relativeValue, relativeUnit } = updateConfig;
    const limit = updateConfig.pointLimit > 0 ? updateConfig.pointLimit : 200;
    const windowSeconds = relativeWindowSeconds(relativeValue, relativeUnit);

    let changed = false;

    data.lines.forEach((line) => {
      if (!line.table || !line.xAxis || !line.yAxis) {
        bufferRef.current[line.id] = [];
        return;
      }

      const rows = rowsByKey[lineKey(line.id)];
      if (!rows) return; // эта линия в этом тике не запрашивалась

      const hadLastSeen = lastSeenRef.current[line.id] != null;

      // парсим только полученные строки (для дельты это считанные единицы)
      const parsed = [];
      for (let i = 0; i < rows.length; i++) {
        const p = parseRow(rows[i], line);
        if (p) parsed.push(p);
      }

      if (!hadLastSeen) {
        // первая загрузка: сортируем один раз и заменяем буфер
        parsed.sort((a, b) => a.time - b.time);
        bufferRef.current[line.id] = parsed;
        changed = true;
      } else if (parsed.length > 0) {
        // дельта уже ASC по запросу — дописываем в конец.
        const buf = bufferRef.current[line.id] || [];
        if (buf.length > 0) {
          // Защита от граничного дубля: если БД из-за потери точности метки вернула
          // ту же строку, что и последняя в буфере, отбрасываем её (точное совпадение
          // сырого originalTime — безопасно, различимые строки не теряются).
          const lastOrig = buf[buf.length - 1].originalTime;
          let i = 0;
          while (i < parsed.length && parsed[i].originalTime === lastOrig) i++;
          const fresh = i > 0 ? parsed.slice(i) : parsed;
          if (fresh.length > 0) {
            bufferRef.current[line.id] = buf.concat(fresh);
            changed = true;
          }
        } else {
          bufferRef.current[line.id] = parsed;
          changed = true;
        }
      }

      // граница дельты = самая свежая точка буфера; затем обрезаем окно
      const buf = bufferRef.current[line.id];
      if (buf && buf.length > 0) {
        lastSeenRef.current[line.id] = buf[buf.length - 1].originalTime;

        if (rangeMode === 'points') {
          if (buf.length > limit) {
            bufferRef.current[line.id] = buf.slice(buf.length - limit);
            changed = true;
          }
        } else if (rangeMode === 'relative' && windowSeconds > 0) {
          const cutoff = buf[buf.length - 1].time - windowSeconds;
          let start = 0;
          while (start < buf.length && buf[start].time < cutoff) start++;
          if (start > 0) {
            bufferRef.current[line.id] = buf.slice(start);
            changed = true;
          }
        }
      }
    });

    if (!changed) return;

    // отдаём график без setNodes: перерисуется только поддерево этой ноды
    setLiveLines(data.lines.map(line => ({ ...line, data: bufferRef.current[line.id] || [] })));

    // в node.data сохраняем троттлингом (~1 раз/сек)
    const now = Date.now();
    if (now - persistAtRef.current > 1000) {
      persistAtRef.current = now;
      persistLinesToNode();
    }
  }, [data.lines, lineKey, updateConfig, persistLinesToNode]);

  // Координатор вызывает эти колбэки на каждом тике. Держим их в ref, чтобы
  // подписка не пересоздавалась при каждом обновлении данных (иначе сбрасывался
  // бы индивидуальный интервал графика).
  const subscriptionRef = useRef({});
  subscriptionRef.current = {
    interval: updateConfig.interval,
    getQueries,
    onResults: applyResults
  };

  // Подписка на общий координатор автообновления.
  // Запросы всех графиков объединяются в один пакетный запрос к серверу.
  useEffect(() => {
    if (!updateConfig.isAutoUpdate) return;

    pollManager.subscribe(id, {
      // На больших выборках не обновляем чаще ~100 мс, даже если задан меньший интервал.
      getInterval: () => {
        const base = subscriptionRef.current.interval;
        let maxLen = 0;
        const b = bufferRef.current;
        for (const k in b) { if (b[k] && b[k].length > maxLen) maxLen = b[k].length; }
        return maxLen > 3000 ? Math.max(base, 100) : base;
      },
      getQueries: () => subscriptionRef.current.getQueries(),
      onResults: (rows) => subscriptionRef.current.onResults(rows)
    });

    return () => pollManager.unsubscribe(id);
  }, [id, updateConfig.isAutoUpdate]);

  // При смене интервала на лету просим координатор пересчитать период таймера
  // (период = минимум интервалов всех подписчиков).
  useEffect(() => {
    if (updateConfig.isAutoUpdate) pollManager.refresh();
  }, [updateConfig.interval, updateConfig.isAutoUpdate]);

  // Сброс буфера при смене окна/режима — следующий тик сделает чистую полную загрузку.
  useEffect(() => {
    lastSeenRef.current = {};
    bufferRef.current = {};
    setLiveLines(null);
  }, [updateConfig.pointLimit, updateConfig.rangeMode, updateConfig.relativeValue, updateConfig.relativeUnit]);

  // Старт/стоп автообновления: на старте — чистый буфер; на стопе — финальный flush в node.data.
  // ВАЖНО: зависим только от isAutoUpdate. persistLinesToNode сюда не кладём — он
  // пересоздаётся при каждом троттл-персисте (меняется data.lines), и тогда эффект
  // ложно перезапускался бы раз в ~1 с, обнуляя буфер и вызывая мигание графика.
  useEffect(() => {
    if (updateConfig.isAutoUpdate) {
      lastSeenRef.current = {};
      bufferRef.current = {};
      persistAtRef.current = 0;
      setLiveLines(null);
    } else if (flushRef.current) {
      flushRef.current(); // финальное сохранение через актуальную версию persist
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateConfig.isAutoUpdate]);

  // Финальное сохранение буфера при размонтировании ноды.
  useEffect(() => () => { if (flushRef.current) flushRef.current(); }, []);

  const toggleAutoUpdate = useCallback(() => {
    const next = { ...updateConfig, isAutoUpdate: !updateConfig.isAutoUpdate };
    setUpdateConfig(next);
    persistUpdateConfig(next);
  }, [updateConfig, persistUpdateConfig]);

  useEffect(() => {
    if (data.initialData && Array.isArray(data.initialData) && data.initialData.length > 0) {
      setChartData(data.initialData);
    }
    
    if (data.dataSourceInfo) {
      setDataSourceInfo(data.dataSourceInfo);
    }
    if (data.dataSourceInfo?.yScaleMode) {
      setYScaleMode(data.dataSourceInfo.yScaleMode);
    }

    if (data.width && data.height) {
      setNodeSize({ width: data.width, height: data.height });
    }
  }, [data.initialData, data.updateTimestamp, data.width, data.height, data.dataSourceInfo]);

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Границы абсолютного окна в epoch-секундах для оси X графика. Считаем так же,
  // как applyResults считает time точек (Date.getTime()/1000), чтобы оси и данные
  // были в одной системе координат. Для остальных режимов — null (ось тянется за данными).
  const absoluteRangeSec = (() => {
    if (updateConfig.rangeMode !== 'absolute') return { start: null, end: null };
    const s = updateConfig.rangeStart ? new Date(updateConfig.rangeStart).getTime() : NaN;
    const e = updateConfig.rangeEnd ? new Date(updateConfig.rangeEnd).getTime() : NaN;
    return {
      start: isNaN(s) ? null : s / 1000,
      end: isNaN(e) ? null : e / 1000
    };
  })();

  return (
    <div 
      ref={nodeRef}
      className={`chart-node ${isResizing ? 'resizing' : ''}`}
      style={{ 
        width: nodeSize.width,
        height: nodeSize.height,
        minWidth: 720,
        minHeight: 400,
        position: 'relative'
      }}
      onContextMenu={handleContextMenu}
    >
      <CustomResizer
        selected={selected}
        id={id}
        nodeSize={nodeSize}
        setNodeSize={setNodeSize}
        setIsResizing={setIsResizing}
        minWidth={720}
        minHeight={400}
        getNode={getNode}
        setNodes={setNodes}
      />
      
      <div className="chart-node-header">
        <div className="chart-node-title">
          <i className="bi bi-bar-chart"></i>
          <EditableTitle 
            value={data.label || 'График'}
            onSave={(newTitle) => {
              setNodes((nds) =>
                nds.map((node) => {
                  if (node.id === id) {
                    return { ...node, data: { ...node.data, label: newTitle } };
                  }
                  return node;
                })
              );
            }}
            isSelected={selected}
          />
          {dataSourceInfo && (
            <span className="data-source-badge ms-2">
              {dataSourceInfo.table}: {dataSourceInfo.xAxis} → {dataSourceInfo.yAxis}
            </span>
          )}
          <span className="resize-indicator">
            Размер: {Math.round(nodeSize.width)}×{Math.round(nodeSize.height)}
          </span>
        </div>
        
        <div className="chart-update-controls nodrag">
          <label className="chart-control-field" title="Режим выбора окна данных">
            <i className="bi bi-clock"></i>
            <select
              className="chart-mode-select"
              value={draftRangeMode}
              onChange={(e) => setDraftRangeMode(e.target.value)}
            >
              <option value="points">Последние точки</option>
              <option value="absolute">Диапазон (с–по)</option>
              <option value="relative">Последние N</option>
            </select>
          </label>
          <label className="chart-control-field" title="Интервал обновления, мс">
            <i className="bi bi-clock-history"></i>
            <input
              type="text"
              inputMode="numeric"
              value={draftInterval}
              onChange={(e) => setDraftInterval(e.target.value.replace(/[^\d]/g, ''))}
              onKeyDown={(e) => { if (e.key === 'Enter') applyUpdateSettings(); }}
            />
            <span className="chart-control-unit">мс</span>
          </label>
          {draftRangeMode === 'points' && (
            <label className="chart-control-field" title="Лимит отображаемых точек">
              <i className="bi bi-bar-chart-steps"></i>
              <input
                type="text"
                inputMode="numeric"
                value={draftPointLimit}
                onChange={(e) => setDraftPointLimit(e.target.value.replace(/[^\d]/g, ''))}
                onKeyDown={(e) => { if (e.key === 'Enter') applyUpdateSettings(); }}
              />
              <span className="chart-control-unit">точ</span>
            </label>
          )}
          {draftRangeMode === 'absolute' && (
            <>
              <label className="chart-control-field" title="Начало диапазона">
                <span className="chart-control-unit">с</span>
                <input
                  type="datetime-local"
                  step="1"
                  value={draftRangeStart}
                  onChange={(e) => setDraftRangeStart(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') applyUpdateSettings(); }}
                />
              </label>
              <label className="chart-control-field" title="Конец диапазона">
                <span className="chart-control-unit">по</span>
                <input
                  type="datetime-local"
                  step="1"
                  value={draftRangeEnd}
                  onChange={(e) => setDraftRangeEnd(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') applyUpdateSettings(); }}
                />
              </label>
            </>
          )}
          {draftRangeMode === 'relative' && (
            <label className="chart-control-field" title="Длина окна (последние N единиц времени)">
              <i className="bi bi-hourglass-split"></i>
              <input
                type="text"
                inputMode="numeric"
                value={draftRelativeValue}
                onChange={(e) => setDraftRelativeValue(e.target.value.replace(/[^\d]/g, ''))}
                onKeyDown={(e) => { if (e.key === 'Enter') applyUpdateSettings(); }}
              />
              <select
                className="chart-mode-select"
                value={draftRelativeUnit}
                onChange={(e) => setDraftRelativeUnit(e.target.value)}
              >
                <option value="seconds">сек</option>
                <option value="minutes">мин</option>
                <option value="hours">час</option>
              </select>
            </label>
          )}
          <button
            className="btn btn-sm chart-apply-btn"
            onClick={applyUpdateSettings}
            disabled={!settingsDirty}
            title="Применить настройки обновления и диапазона"
          >
            <i className="bi bi-check-lg"></i>
          </button>
          <button
            className={`btn btn-sm update-toggle-btn ${updateConfig.isAutoUpdate ? 'btn-success' : 'btn-outline-secondary'}`}
            onClick={toggleAutoUpdate}
            disabled={!dataSourceInfo && (!data.lines || data.lines.length === 0)}
            title={(dataSourceInfo || (data.lines && data.lines.length > 0)) ?
              (updateConfig.isAutoUpdate ? "Остановить автообновление" : "Включить автообновление из БД") :
              "Сначала выберите источник данных или добавьте линии"}
          >
            <i className={`bi ${updateConfig.isAutoUpdate ? 'bi-pause-circle' : 'bi-play-circle'}`}></i>
          </button>
        </div>
      </div>
      
      <div className="chart-node-content nodrag">
        <Chart
          chartData={chartData}
          lines={updateConfig.isAutoUpdate && liveLines ? liveLines : data.lines}
          width={nodeSize.width}
          height={nodeSize.height - 50}
          yScaleMode={yScaleMode}
          isAutoUpdate={updateConfig.isAutoUpdate}
          pointLimit={updateConfig.pointLimit}
          rangeMode={updateConfig.rangeMode}
          rangeStartSec={absoluteRangeSec.start}
          rangeEndSec={absoluteRangeSec.end}
        />
      </div>
    </div>
  );
};

export default LinearChartNode;