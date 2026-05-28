import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import Chart from '../components/Chart';
import EditableTitle from './EditableTitle';
import CustomResizer from './CustomResizer';

const LinearChartNode = ({ data, isConnectable, selected, id }) => {
  const { getNode, setNodes } = useReactFlow();
  const [chartData, setChartData] = useState([]);
  const [nodeSize, setNodeSize] = useState({ width: data.width || 600, height: data.height || 1200 });
  const [isResizing, setIsResizing] = useState(false);
  const [updateConfig, setUpdateConfig] = useState({
    interval: 20,
    isAutoUpdate: false,
    lastUpdateTime: null
  });
  const [dataSourceInfo, setDataSourceInfo] = useState(null);
  const [yScaleMode, setYScaleMode] = useState('dynamic');
  const nodeRef = useRef(null);
  const isUpdatingRef = useRef(false);
  const prevLinesDataRef = useRef(null);
  const [pollingIntervalId, setPollingIntervalId] = useState(null);

  const API_BASE_URL = 'http://localhost:8080/api';

  // Функция для загрузки данных из БД
  const fetchDataFromDB = useCallback(async () => {
    if (!dataSourceInfo || !dataSourceInfo.table || !dataSourceInfo.xAxis || !dataSourceInfo.yAxis) {
      return;
    }

    try {
      let sql = `SELECT * FROM ${dataSourceInfo.table}`;
      
      if (updateConfig.lastUpdateTime) {
        const lastTime = updateConfig.lastUpdateTime.toISOString();
        sql += ` WHERE ${dataSourceInfo.xAxis} > '${lastTime}'`;
      }
      
      sql += ` ORDER BY ${dataSourceInfo.xAxis} DESC LIMIT 200`;
      
      const response = await fetch(`${API_BASE_URL}/execute-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql })
      });

      if (!response.ok) throw new Error('Ошибка загрузки данных из БД');
      
      const result = await response.json();
      const newData = result.data || result;
      
      if (newData && newData.length > 0) {
        const formattedData = newData
          .filter(row => row[dataSourceInfo.xAxis] != null && row[dataSourceInfo.yAxis] != null)
          .map((row, index) => {
            const xValue = row[dataSourceInfo.xAxis];
            const yValue = parseFloat(row[dataSourceInfo.yAxis]);
            
            let timeValue;
            if (xValue instanceof Date) {
              timeValue = xValue.getTime() / 1000;
            } else if (typeof xValue === 'string') {
              const timeMatch = xValue.match(/(\d{1,2}):(\d{1,2}):(\d{1,2})(?:\.(\d+))?/);
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
                const fullDateMatch = xValue.match(/\d{4}-\d{2}-\d{2}/);
                if (fullDateMatch) {
                  const date = new Date(xValue);
                  if (!isNaN(date.getTime())) {
                    timeValue = date.getTime() / 1000;
                  } else {
                    timeValue = parseFloat(xValue) || index;
                  }
                } else {
                  timeValue = parseFloat(xValue) || index;
                }
              }
            } else if (typeof xValue === 'number') {
              timeValue = xValue;
            } else {
              timeValue = index;
            }
            
            return {
              time: timeValue,
              value: isNaN(yValue) ? 0 : yValue,
              originalTime: xValue,
              originalValue: row[dataSourceInfo.yAxis],
              seriesId: 'database',
              timestamp: Date.now(),
              overload: row.is_overload || false
            };
          });
        
        formattedData.sort((a, b) => a.time - b.time);
        setChartData(formattedData);
        
        if (formattedData.length > 0) {
          const lastRow = newData[newData.length - 1];
          const lastTime = lastRow[dataSourceInfo.xAxis];
          const date = new Date(lastTime);
          if (!isNaN(date.getTime())) {
            setUpdateConfig(prev => ({ ...prev, lastUpdateTime: date }));
          }
        }
      }
    } catch (error) {
      console.error('Ошибка загрузки данных из БД:', error);
    }
  }, [dataSourceInfo, updateConfig.lastUpdateTime]);

  // Функция для загрузки данных всех линий из БД (автообновление)
  const fetchLinesDataFromDB = useCallback(async () => {
    if (isUpdatingRef.current || !data.lines || data.lines.length === 0) {
      return;
    }

    isUpdatingRef.current = true;

    try {
      const loadPromises = data.lines.map(async (line) => {
        if (!line.table || !line.xAxis || !line.yAxis) {
          return { ...line, data: [] };
        }
        
        const sql = `SELECT * FROM ${line.table} ORDER BY 1 DESC LIMIT 200`;
        
        const response = await fetch(`${API_BASE_URL}/execute-query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sql })
        });

        if (!response.ok) throw new Error(`Ошибка загрузки данных для линии ${line.name}`);
        
        const result = await response.json();
        const dbData = result.data || result;
        
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
      
      const updatedLines = await Promise.all(loadPromises);
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
    } catch (err) {
      console.error('Ошибка автообновления линий:', err);
    } finally {
      isUpdatingRef.current = false;
    }
  }, [id, setNodes, data.lines]);

  // Запуск/остановка опроса БД
  useEffect(() => {
    if (updateConfig.isAutoUpdate) {
      const hasLines = data.lines && data.lines.length > 0;
      const hasDataSource = dataSourceInfo && dataSourceInfo.table;
      
      let fetchFunction = null;
      
      if (hasLines) {
        fetchFunction = fetchLinesDataFromDB;
      } else if (hasDataSource) {
        fetchFunction = fetchDataFromDB;
      }
      
      if (!fetchFunction) return;
      
      fetchFunction();
      const interval = setInterval(fetchFunction, updateConfig.interval);
      setPollingIntervalId(interval);
      
      return () => {
        clearInterval(interval);
        setPollingIntervalId(null);
      };
    } else {
      if (pollingIntervalId) {
        clearInterval(pollingIntervalId);
        setPollingIntervalId(null);
      }
    }
  }, [updateConfig.isAutoUpdate, updateConfig.interval, dataSourceInfo, data.lines, fetchDataFromDB, fetchLinesDataFromDB]);

  const toggleAutoUpdate = useCallback(() => {
    const newState = !updateConfig.isAutoUpdate;
    setUpdateConfig(prev => ({ ...prev, isAutoUpdate: newState }));
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
        
        <div className="chart-update-controls">
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
        />
      </div>
    </div>
  );
};

export default LinearChartNode;