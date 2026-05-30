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
  const [updateConfig, setUpdateConfig] = useState({
    interval: 20,
    isAutoUpdate: false,
    lastUpdateTime: null
  });
  const [currentLines, setCurrentLines] = useState([]);
  const nodeRef = useRef(null);

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

  const toggleAutoUpdate = useCallback(() => {
    setUpdateConfig(prev => ({ ...prev, isAutoUpdate: !prev.isAutoUpdate }));
  }, []);

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
        
        <div className="chart-update-controls">
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