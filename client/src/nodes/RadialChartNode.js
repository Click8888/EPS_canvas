import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import RadialChart from '../components/RadialChart';
import EditableTitle from './EditableTitle';
import CustomResizer from './CustomResizer';

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
  const [pollingIntervalId, setPollingIntervalId] = useState(null);
  const nodeRef = useRef(null);
  const isUpdatingRef = useRef(false);

  const API_BASE_URL = 'http://localhost:8080/api';

  // Функция для загрузки данных всех линий из БД (автообновление)
  const fetchLinesDataFromDB = useCallback(async () => {
    if (isUpdatingRef.current || !currentLines || currentLines.length === 0) return;

    isUpdatingRef.current = true;
    try {
      const loadPromises = currentLines.map(async (line) => {
        if (!line.table || !line.angleAxis || !line.magnitudeAxis) return { ...line, data: [] };
        
        const sql = `SELECT * FROM ${line.table} ORDER BY 1 DESC LIMIT 1`;
        
        const response = await fetch(`${API_BASE_URL}/execute-query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sql })
        });

        if (!response.ok) throw new Error(`Ошибка загрузки для ${line.name}`);
        
        const result = await response.json();
        const dbData = result.data || result;
        
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
      
      const updatedLines = await Promise.all(loadPromises);
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
    } catch (err) {
      console.error('Ошибка автообновления радиального графика:', err);
    } finally {
      isUpdatingRef.current = false;
    }
  }, [id, setNodes, currentLines]);

  // Запуск/остановка опроса БД
  useEffect(() => {
    if (updateConfig.isAutoUpdate) {
      const hasLines = currentLines && currentLines.length > 0;
      if (hasLines) {
        fetchLinesDataFromDB();
        const interval = setInterval(fetchLinesDataFromDB, updateConfig.interval);
        setPollingIntervalId(interval);
        return () => clearInterval(interval);
      }
    } else {
      if (pollingIntervalId) {
        clearInterval(pollingIntervalId);
        setPollingIntervalId(null);
      }
    }
  }, [updateConfig.isAutoUpdate, updateConfig.interval, fetchLinesDataFromDB]);

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