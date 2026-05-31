import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import Chart from '../components/Chart';
import EditableTitle from './EditableTitle';
import CustomResizer from './CustomResizer';
import * as pollManager from '../services/pollManager';

const LinearChartNode = ({ data, isConnectable, selected, id, data_normal }) => {
  const { getNode, setNodes } = useReactFlow();
  const [chartData, setChartData] = useState([]);
  const [nodeSize, setNodeSize] = useState({ width: data.width || 600, height: data.height || 1200 });
  const [isResizing, setIsResizing] = useState(false);
  const [updateConfig, setUpdateConfig] = useState({
    interval: 20,
    pointLimit: 200,
    isAutoUpdate: false,
    lastUpdateTime: null
  });
  const [dataSourceInfo, setDataSourceInfo] = useState(null);
  const [yScaleMode, setYScaleMode] = useState('dynamic');
  // Черновые значения полей: применяются в updateConfig только по подтверждению.
  const [draftInterval, setDraftInterval] = useState(String(updateConfig.interval));
  const [draftPointLimit, setDraftPointLimit] = useState(String(updateConfig.pointLimit));
  const nodeRef = useRef(null);
  const prevLinesDataRef = useRef(null);

  // Применяет введённые интервал и лимит точек к настройкам графика.
  const applyUpdateSettings = useCallback(() => {
    const interval = Math.max(1, parseInt(draftInterval, 10) || 1);
    const pointLimit = Math.max(1, parseInt(draftPointLimit, 10) || 1);
    setDraftInterval(String(interval));
    setDraftPointLimit(String(pointLimit));
    setUpdateConfig(prev => ({ ...prev, interval, pointLimit }));
  }, [draftInterval, draftPointLimit]);

  // Есть ли несохранённые изменения в полях (для подсветки кнопки подтверждения).
  const settingsDirty =
    String(updateConfig.interval) !== draftInterval ||
    String(updateConfig.pointLimit) !== draftPointLimit;

  // Ключ линии в общем координаторе автообновления.
  const lineKey = useCallback((lineId) => `${id}:${lineId}`, [id]);

  // Строит SQL-запросы всех настроенных линий для пакетной отправки.
  // LIMIT берётся из настраиваемого лимита точек графика.
  const getQueries = useCallback(() => {
    if (!data.lines || data.lines.length === 0) return [];
    const limit = updateConfig.pointLimit > 0 ? updateConfig.pointLimit : 200;
    return data.lines
      .filter(line => line.table && line.xAxis && line.yAxis)
      .map(line => ({
        key: lineKey(line.id),
        sql: `SELECT * FROM ${line.table} ORDER BY 1 DESC LIMIT ${limit}`
      }));
  }, [data.lines, lineKey, updateConfig.pointLimit]);

  // Принимает строки из пакетного ответа и обновляет данные узла.
  const applyResults = useCallback((rowsByKey) => {
    if (!data.lines || data.lines.length === 0) return;

    const updatedLines = data.lines.map((line) => {
      if (!line.table || !line.xAxis || !line.yAxis) {
        return { ...line, data: [] };
      }

      const dbData = rowsByKey[lineKey(line.id)] || [];

      const formattedData = dbData
        .filter(row => row[line.xAxis] != null && row[line.yAxis] != null)
        .map((row) => {
          const yValue = parseFloat(row[line.yAxis]);
          const xValue = row[line.xAxis];

          let timeValue;
          if (xValue instanceof Date) {
            timeValue = xValue.getTime() / 1000;
          } else if (typeof xValue === 'string') {
            const fullDateMatch = xValue.match(/\d{4}-\d{2}-\d{2}/);
            if (fullDateMatch) {
              const date = new Date(xValue);
              if (!isNaN(date.getTime())) {
                timeValue = date.getTime() / 1000;
              } else {
                timeValue = parseFloat(xValue) || 0;
              }
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

          return {
            time: timeValue,
            value: isNaN(yValue) ? 0 : yValue,
            originalTime: xValue,
            originalValue: row[line.yAxis],
            seriesId: line.id,
            timestamp: Date.now()
          };
        });

      formattedData.sort((a, b) => a.time - b.time);
      return { ...line, data: formattedData };
    });

    const allDataPoints = updatedLines.flatMap(line => line.data || []);
    allDataPoints.sort((a, b) => a.time - b.time);

    if (allDataPoints.length > 0) {
      setChartData(allDataPoints);
    }

    const newLinesSnapshot = JSON.stringify(updatedLines.map(l => ({
      id: l.id,
      dataLength: l.data?.length,
      lastPoint: l.data?.length > 0 ? l.data[l.data.length - 1] : null
    })));

    if (prevLinesDataRef.current !== newLinesSnapshot) {
      prevLinesDataRef.current = newLinesSnapshot;
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === id && node.type === 'linearChartNode') {
            return {
              ...node,
              data: { ...node.data, lines: updatedLines, updateTimestamp: Date.now() }
            };
          }
          return node;
        })
      );
    }
  }, [id, setNodes, data.lines, lineKey]);

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

  // При смене интервала на лету просим координатор пересчитать период таймера
  // (период = минимум интервалов всех подписчиков).
  useEffect(() => {
    if (updateConfig.isAutoUpdate) pollManager.refresh();
  }, [updateConfig.interval, updateConfig.isAutoUpdate]);

  const toggleAutoUpdate = useCallback(() => {
    const newState = !updateConfig.isAutoUpdate;
    setUpdateConfig(prev => ({ ...prev, isAutoUpdate: newState }));
    console.log(data)
  }, [updateConfig.isAutoUpdate]);

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
          <label className="chart-control-field" title="Лимит отображаемых точек">
            <i className="bi bi-bar-chart-steps"></i>
            <input
              type="text"
              inputMode="numeric"
              value={draftPointLimit}
              onChange={(e) => setDraftPointLimit(e.target.value.replace(/[^\d]/g, ''))}
              onKeyDown={(e) => { if (e.key === 'Enter') applyUpdateSettings(); }}
            />
            <span className="chart-control-unit">тчк</span>
          </label>
          <button
            className="btn btn-sm chart-apply-btn"
            onClick={applyUpdateSettings}
            disabled={!settingsDirty}
            title="Применить интервал и лимит точек"
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
          lines={data.lines}
          width={nodeSize.width}
          height={nodeSize.height - 50}
          yScaleMode={yScaleMode}
          isAutoUpdate={updateConfig.isAutoUpdate}
          pointLimit={updateConfig.pointLimit}
        />
      </div>
    </div>
  );
};

export default LinearChartNode;