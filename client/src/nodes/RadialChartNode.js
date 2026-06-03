import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import RadialChart from '../components/RadialChart';
import EditableTitle from './EditableTitle';
import CustomResizer from './CustomResizer';
import * as pollManager from '../services/pollManager';

const RadialChartNode = ({ data, isConnectable, selected, id }) => {
  const { getNode, setNodes } = useReactFlow();
  const [nodeSize, setNodeSize] = useState({ width: data.width || 800, height: data.height || 800 });
  const [isResizing, setIsResizing] = useState(false);
  // Настройки обновления поднимаются в node.data, чтобы сохраняться в конфигурации полотна.
  // На монтировании сеем из data.updateConfig, автообновление всегда стартует выключенным.
  const [updateConfig, setUpdateConfig] = useState(() => ({
    interval: 20,
    lastUpdateTime: null,
    ...(data.updateConfig || {}),
    isAutoUpdate: false
  }));
  const [currentLines, setCurrentLines] = useState([]);
  // Черновое значение интервала: применяется в updateConfig только по подтверждению.
  const [draftInterval, setDraftInterval] = useState(String(updateConfig.interval));
  const nodeRef = useRef(null);

  // Сохраняет настройки обновления в node.data, чтобы они попали в конфигурацию полотна.
  const persistUpdateConfig = useCallback((cfg) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, updateConfig: cfg } } : node
      )
    );
  }, [id, setNodes]);

  // Применяет введённый интервал к настройкам графика.
  const applyUpdateSettings = useCallback(() => {
    const interval = Math.max(1, parseInt(draftInterval, 10) || 1);
    setDraftInterval(String(interval));
    const next = { ...updateConfig, interval };
    setUpdateConfig(next);
    persistUpdateConfig(next);
  }, [updateConfig, draftInterval, persistUpdateConfig]);

  // Есть ли несохранённое изменение интервала (для подсветки кнопки подтверждения).
  const settingsDirty = String(updateConfig.interval) !== draftInterval;

  // Ключ линии в общем координаторе автообновления.
  const lineKey = useCallback((lineId) => `${id}:${lineId}`, [id]);

  // Строит SQL-запросы всех настроенных линий для пакетной отправки.
  const getQueries = useCallback(() => {
    if (!currentLines || currentLines.length === 0) return [];
    return currentLines
      .filter(line => line.table && line.angleAxis && line.magnitudeAxis)
      .map(line => ({
        key: lineKey(line.id),
        sql: `SELECT * FROM ${line.table} ORDER BY 1 DESC LIMIT 1`
      }));
  }, [currentLines, lineKey]);

  // Принимает строки из пакетного ответа и обновляет данные узла.
  const applyResults = useCallback((rowsByKey) => {
    if (!currentLines || currentLines.length === 0) return;

    const updatedLines = currentLines.map((line) => {
      if (!line.table || !line.angleAxis || !line.magnitudeAxis) {
        return { ...line, data: [] };
      }

      const dbData = rowsByKey[lineKey(line.id)] || [];
      if (dbData.length > 0) {
        const row = dbData[0];
        const angleValue = parseFloat(row[line.angleAxis]);
        const magnitudeValue = parseFloat(row[line.magnitudeAxis]);

        return {
          ...line,
          data: [{
            angle: isNaN(angleValue) ? 0 : angleValue,
            value: isNaN(magnitudeValue) ? 0 : magnitudeValue,
            timestamp: Date.now()
          }]
        };
      }

      return { ...line, data: [] };
    });

    setCurrentLines(updatedLines);

    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id && node.type === 'radialChartNode') {
          return {
            ...node,
            data: {
              ...node.data,
              lines: updatedLines,
              updateTimestamp: Date.now()
            }
          };
        }
        return node;
      })
    );
  }, [id, setNodes, currentLines, lineKey]);

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
      getInterval: () => subscriptionRef.current.interval,
      getQueries: () => subscriptionRef.current.getQueries(),
      onResults: (rows) => subscriptionRef.current.onResults(rows)
    });

    return () => pollManager.unsubscribe(id);
  }, [id, updateConfig.isAutoUpdate]);

  // При смене интервала на лету просим координатор пересчитать период таймера.
  useEffect(() => {
    if (updateConfig.isAutoUpdate) pollManager.refresh();
  }, [updateConfig.interval, updateConfig.isAutoUpdate]);

  const toggleAutoUpdate = useCallback(() => {
    const next = { ...updateConfig, isAutoUpdate: !updateConfig.isAutoUpdate };
    setUpdateConfig(next);
    persistUpdateConfig(next);
  }, [updateConfig, persistUpdateConfig]);

  useEffect(() => {
    if (data.width && data.height) {
      setNodeSize({ width: data.width, height: data.height });
    }
  }, [data.width, data.height]);

  useEffect(() => {
    if (data.lines && Array.isArray(data.lines)) {
      setCurrentLines(data.lines);
    }
  }, [data.lines, data.updateTimestamp]);

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div 
      ref={nodeRef}
      className={`radial-chart-node ${isResizing ? 'resizing' : ''}`}
      style={{ 
        width: nodeSize.width,
        height: nodeSize.height,
        minWidth: 600,
        minHeight: 600,
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
        minWidth={600}
        minHeight={600}
        maxWidth={2000}
        maxHeight={2000}
        getNode={getNode}
        setNodes={setNodes}
      />
      
      <div className="chart-node-header">
        <div className="chart-node-title">
          <i className="bi bi-radar"></i>
          <EditableTitle 
            value={data.label || 'Радиальный график'}
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
          <span className="resize-indicator">
            Размер: {Math.round(nodeSize.width)}×{Math.round(nodeSize.height)}
          </span>
        </div>
        
        <div className="chart-update-controls nodrag">
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
            disabled={!currentLines || currentLines.length === 0}
            title={updateConfig.isAutoUpdate ? "Остановить автообновление" : "Включить автообновление из БД"}
          >
            <i className={`bi ${updateConfig.isAutoUpdate ? 'bi-pause-circle' : 'bi-play-circle'}`}></i>
          </button>
        </div>
      </div>
      
      <div className="chart-node-content nodrag">
        <RadialChart
          lines={currentLines}
          width={nodeSize.width}
          height={nodeSize.height - 50}
          maxHistorySize={1}
          isAutoUpdate={updateConfig.isAutoUpdate}
        />
      </div>
    </div>
  );
};

export default RadialChartNode;