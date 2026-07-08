import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import EditableTitle from './EditableTitle';
import CustomResizer from './CustomResizer';
import * as pollManager from '../services/pollManager';

const API_BASE_URL = 'http://localhost:8080/api';

// Сравнивает значение из БД с настроенным значением состояния.
// Логика «булевская», но терпимая к типам: true/false → 1/0, числа сравниваем
// как числа, остальное — как строки без учёта крайних пробелов.
const valuesEqual = (dbVal, stateVal) => {
  if (dbVal === null || dbVal === undefined) return false;
  let a = dbVal;
  if (typeof a === 'boolean') a = a ? 1 : 0;
  const sv = String(stateVal).trim();
  if (sv === '') return false;
  const na = Number(a);
  const ns = Number(sv);
  if (!Number.isNaN(na) && !Number.isNaN(ns)) return na === ns;
  return String(a).trim() === sv;
};

// Человекочитаемое текущее значение для крупной подписи.
const formatValue = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (typeof v === 'number') return String(v);
  return String(v);
};

// Узел-индикатор: показывает текущее значение выбранного столбца и «лампу»,
// которая горит цветом того состояния, которому равно значение (напр. 0 → красный,
// 1 → зелёный). Источник данных и список состояний настраиваются в сайдбаре и
// хранятся в node.data (table, column, states[]), поэтому попадают в сохранение полотна.
const IndicatorNode = ({ data, selected, id }) => {
  const { getNode, setNodes } = useReactFlow();
  // Стартовый размер крупнее, чтобы контролы шапки и строки значений не ужимались.
  const [nodeSize, setNodeSize] = useState({ width: data.width || 400, height: data.height || 240 });
  const [isResizing, setIsResizing] = useState(false);
  const [row, setRow] = useState(null); // последняя строка БД: из неё читаем все выбранные столбцы

  // Настройки обновления в node.data (сохраняются в конфигурации полотна),
  // автообновление всегда стартует выключенным.
  const [updateConfig, setUpdateConfig] = useState(() => ({
    interval: 500,
    ...(data.updateConfig || {}),
    isAutoUpdate: false
  }));
  const [draftInterval, setDraftInterval] = useState(String(updateConfig.interval ?? 500));
  const nodeRef = useRef(null);

  const table = data.table || '';
  // columns — список выводимых столбцов. Поддерживаем и старый формат (одиночный column).
  const columns = Array.isArray(data.columns)
    ? data.columns
    : (data.column ? [data.column] : []);
  const states = Array.isArray(data.states) ? data.states : [];
  const configured = Boolean(table && columns.length > 0);
  // Для запроса достаточно выбранной таблицы: берём всю последнюю строку (SELECT *).
  const sql = table ? `SELECT * FROM ${table} ORDER BY 1 DESC LIMIT 1` : null;
  // Свёрнутый «режим просмотра»: только название + значения, без контролов и ресайза.
  const collapsed = Boolean(data.collapsed);

  // Сохраняет настройки обновления в node.data.
  const persistUpdateConfig = useCallback((cfg) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, updateConfig: cfg } } : node
      )
    );
  }, [id, setNodes]);

  const applyUpdateSettings = useCallback(() => {
    const interval = Math.max(1, parseInt(draftInterval, 10) || 1);
    setDraftInterval(String(interval));
    const next = { ...updateConfig, interval };
    setUpdateConfig(next);
    persistUpdateConfig(next);
  }, [updateConfig, draftInterval, persistUpdateConfig]);

  const settingsDirty = String(updateConfig.interval) !== draftInterval;

  // Размер восстанавливается из data (импорт/загрузка полотна).
  useEffect(() => {
    if (data.width && data.height) {
      setNodeSize({ width: data.width, height: data.height });
    }
  }, [data.width, data.height]);

  // Одноразовая загрузка текущего значения, чтобы индикатор показывал состояние
  // сразу при выборе источника и без включённого автообновления.
  useEffect(() => {
    let cancelled = false;
    if (!table) {
      setRow(null);
      return;
    }
    (async () => {
      try {
        const resp = await fetch(`${API_BASE_URL}/execute-query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sql: `SELECT * FROM ${table} ORDER BY 1 DESC LIMIT 1` })
        });
        if (!resp.ok) return;
        const result = await resp.json();
        const rows = result.data || result;
        if (!cancelled && Array.isArray(rows) && rows.length > 0) {
          setRow(rows[0]);
        }
      } catch {
        /* тихо игнорируем — покажем «—» */
      }
    })();
    return () => { cancelled = true; };
  }, [table]);

  // Колбэки координатора держим в ref, чтобы подписка не пересоздавалась на каждый тик.
  const subscriptionRef = useRef({});
  subscriptionRef.current = {
    interval: updateConfig.interval,
    getQueries: () => (sql ? [{ key: `${id}:v`, sql }] : []),
    onResults: (rowsByKey) => {
      const rows = rowsByKey[`${id}:v`] || [];
      if (rows.length > 0) setRow(rows[0]);
    }
  };

  // Подписка на общий координатор автообновления (тот же, что у графиков).
  useEffect(() => {
    if (!updateConfig.isAutoUpdate) return;
    pollManager.subscribe(id, {
      getInterval: () => subscriptionRef.current.interval,
      getQueries: () => subscriptionRef.current.getQueries(),
      onResults: (rows) => subscriptionRef.current.onResults(rows)
    });
    return () => pollManager.unsubscribe(id);
  }, [id, updateConfig.isAutoUpdate]);

  useEffect(() => {
    if (updateConfig.isAutoUpdate) pollManager.refresh();
  }, [updateConfig.interval, updateConfig.isAutoUpdate]);

  const toggleAutoUpdate = useCallback(() => {
    const next = { ...updateConfig, isAutoUpdate: !updateConfig.isAutoUpdate };
    setUpdateConfig(next);
    persistUpdateConfig(next);
  }, [updateConfig, persistUpdateConfig]);

  // Сворачивание в режим просмотра. Флаг в node.data — сохраняется в полотне.
  // Автообновление при этом не трогаем: свёрнутый узел продолжает обновляться.
  const toggleCollapsed = useCallback(() => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, collapsed: !node.data.collapsed } } : node
      )
    );
  }, [id, setNodes]);

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div
      ref={nodeRef}
      className={`indicator-node ${collapsed ? 'collapsed' : ''} ${isResizing ? 'resizing' : ''}`}
      style={{
        width: nodeSize.width,
        height: nodeSize.height,
        minWidth: 240,
        minHeight: 160,
        position: 'relative'
      }}
      onContextMenu={handleContextMenu}
    >
      {/* Ресайз доступен в обоих режимах, включая свёрнутый (просмотр). */}
      <CustomResizer
        selected={selected}
        id={id}
        nodeSize={nodeSize}
        setNodeSize={setNodeSize}
        setIsResizing={setIsResizing}
        minWidth={240}
        minHeight={160}
        getNode={getNode}
        setNodes={setNodes}
      />

      <div className="chart-node-header">
        <div className="chart-node-title">
          <i className="bi bi-lightbulb"></i>
          <EditableTitle
            value={data.label || 'Индикатор'}
            onSave={(newTitle) =>
              setNodes((nds) =>
                nds.map((node) =>
                  node.id === id ? { ...node, data: { ...node.data, label: newTitle } } : node
                )
              )
            }
            isSelected={selected}
          />
        </div>

        <div className="indicator-header-actions nodrag">
          {/* Контролы обновления видны только в развёрнутом виде. */}
          {!collapsed && (
            <div className="chart-update-controls">
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
              <button
                className="btn btn-sm chart-apply-btn"
                onClick={applyUpdateSettings}
                disabled={!settingsDirty}
                title="Применить интервал"
              >
                <i className="bi bi-check-lg"></i>
              </button>
              <button
                className={`btn btn-sm update-toggle-btn ${updateConfig.isAutoUpdate ? 'btn-success' : 'btn-outline-secondary'}`}
                onClick={toggleAutoUpdate}
                disabled={!configured}
                title={updateConfig.isAutoUpdate ? 'Остановить автообновление' : 'Включить автообновление из БД'}
              >
                <i className={`bi ${updateConfig.isAutoUpdate ? 'bi-pause-circle' : 'bi-play-circle'}`}></i>
              </button>
            </div>
          )}
          {/* Кнопка сворачивания/возврата — видна всегда. */}
          <button
            className="btn btn-sm indicator-collapse-btn"
            onClick={toggleCollapsed}
            title={collapsed ? 'Развернуть (режим настройки)' : 'Свернуть до просмотра'}
          >
            <i className={`bi ${collapsed ? 'bi-arrows-angle-expand' : 'bi-arrows-angle-contract'}`}></i>
          </button>
        </div>
      </div>

      <div className="indicator-node-body nodrag nowheel">
        {!configured ? (
          <div className="indicator-hint">
            <i className="bi bi-info-circle me-1"></i>
            Выберите таблицу и хотя бы один столбец в панели управления
          </div>
        ) : (
          <div className="indicator-items">
            {columns.map((col) => {
              const v = row ? row[col] : undefined;
              const matched = states.find((s) => valuesEqual(v, s.value));
              const color = matched ? matched.color : null;
              return (
                <div key={col} className="indicator-item">
                  {/* сплошной кружок без свечения; серый — если значение ни с чем не совпало */}
                  <span
                    className={`indicator-dot ${color ? 'on' : 'off'}`}
                    style={{
                      background: color || 'var(--bg-secondary)',
                      borderColor: color || 'var(--border-color)'
                    }}
                  />
                  <span className="indicator-item-label" title={col}>{col}</span>
                  <span className="indicator-item-value">
                    {formatValue(v)}{matched && matched.label ? ` · ${matched.label}` : ''}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default IndicatorNode;
