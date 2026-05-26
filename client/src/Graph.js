import React, { useState, useCallback, useEffect, useRef } from 'react';
import { 
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  NodeResizer,
  ReactFlowProvider,
  useReactFlow,
  Panel
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './Graph.css';
import Sidebar from './components/Sidebar';
import Chart from './components/Chart';
import RadialChart from './components/RadialChart';
import { useTheme } from './components/ThemeContext';

// Компонент редактируемого заголовка
const EditableTitle = ({ value, onSave, isSelected }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    if (editValue.trim() && editValue !== value) {
      onSave(editValue.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditValue(value);
      setIsEditing(false);
    }
  };

  const handleBlur = () => {
    handleSave();
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        className="chart-title-input"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#2d2d2d',
          border: '1px solid #6c757d',
          borderRadius: '4px',
          color: '#fff',
          fontSize: '14px',
          fontWeight: '500',
          padding: '2px 8px',
          outline: 'none',
          width: 'auto',
          minWidth: '100px'
        }}
      />
    );
  }

  return (
    <div 
      className="chart-title-display"
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (isSelected) {
          setIsEditing(true);
        }
      }}
      style={{ cursor: isSelected ? 'pointer' : 'default', display: 'inline-flex', alignItems: 'center' }}
      title={isSelected ? "Нажмите для переименования" : ""}
    >
      <span>{value}</span>
      {isSelected && (
        <i 
          className="bi bi-pencil-square ms-2" 
          style={{ fontSize: '12px', opacity: 0.6, cursor: 'pointer' }}
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(true);
          }}
        />
      )}
    </div>
  );
};

const getCursor = (direction) => {
  switch (direction) {
    case 'top-left':
    case 'bottom-right': return 'nwse-resize';
    case 'top-right':
    case 'bottom-left': return 'nesw-resize';
    case 'top':
    case 'bottom':      return 'ns-resize';
    case 'left':
    case 'right':       return 'ew-resize';
    default:            return 'default';
  }
};

// Кастомный узел для графика
const ChartNode = ({ data, isConnectable, selected, id }) => {
  const { getNode, setNodes } = useReactFlow();
  const [chartData, setChartData] = useState([]);
  const [activeGraphUpdate, setActiveGraphUpdate] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [chartSeries, setChartSeries] = useState([]);
  const [additionalSeries, setAdditionalSeries] = useState([]); // НОВОЕ: дополнительные линии
  const [nodeSize, setNodeSize] = useState({ width: 600, height: 1200 });
  const [isResizing, setIsResizing] = useState(false);
  const [updateConfig, setUpdateConfig] = useState({
    interval: 20, // Интервал обновления из БД в мс
    isAutoUpdate: false, // Автоматическое обновление
    isSettingsOpen: false,
    lastUpdateTime: null // Время последнего обновления
  });
  const [intervalInput, setIntervalInput] = useState("100");
  const [dataSourceInfo, setDataSourceInfo] = useState(null);
  const [pollingIntervalId, setPollingIntervalId] = useState(null);
  const [wsConnection, setWsConnection] = useState(null);
  const [yScaleMode, setYScaleMode] = useState('dynamic');
  const nodeRef = useRef(null);
  const updateIntervalRef = useRef(null);
  const settingsPanelRef = useRef(null);
  const chartWrapperRef = useRef(null);
  
  // Flag to track if we're interacting with the chart
  const isChartInteractionRef = useRef(false);
  
  const isUpdatingRef = useRef(false);
  const prevLinesDataRef = useRef(null);

  // Функция для загрузки данных из БД
  const fetchDataFromDB = useCallback(async () => {
  if (!dataSourceInfo || !dataSourceInfo.table || !dataSourceInfo.xAxis || !dataSourceInfo.yAxis) {
    console.log('Нет информации об источнике данных');
    return;
  }

  try {
    setIsUpdating(true);
    
    // Формируем SQL запрос БЕЗ лимита
    let sql = `SELECT * FROM ${dataSourceInfo.table}`;
    
    // Если есть время последнего обновления, фильтруем новые данные
    if (updateConfig.lastUpdateTime) {
      const lastTime = updateConfig.lastUpdateTime.toISOString();
      sql += ` WHERE ${dataSourceInfo.xAxis} > '${lastTime}'`;
    }
    
    sql += ` ORDER BY ${dataSourceInfo.xAxis} DESC LIMIT 200`;
    //sql += ` LIMIT 1000`
    console.log('Выполняем SQL:', sql);
    
    const response = await fetch('http://localhost:8080/api/execute-query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql })
    });

    if (!response.ok) throw new Error('Ошибка загрузки данных из БД');
    
    const result = await response.json();
    const newData = result.data || result;
    
    if (newData && newData.length > 0) {
      //console.log(`Получено ${newData.length} новых записей из БД`);
      
      // Форматируем данные для графика
      const formattedData = newData
        .filter(row => row[dataSourceInfo.xAxis] != null && row[dataSourceInfo.yAxis] != null)
        .map((row, index) => {
          const xValue = row[dataSourceInfo.xAxis];
          const yValue = parseFloat(row[dataSourceInfo.yAxis]);
          
          // Преобразуем время
          let timeValue;
          if (xValue instanceof Date) {
            // Если это объект Date из БД, сохраняем как есть
            timeValue = xValue.getTime() / 1000;
          } else if (typeof xValue === 'string') {
            // Сначала проверяем формат HH:MM:SS.mmm
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
      
      // Сортируем по времени
      formattedData.sort((a, b) => a.time - b.time);
      
      // Обновляем данные графика
      setChartData(() => {
        formattedData.sort((a, b) => a.time - b.time);
        return formattedData;
      });
      
      // Обновляем время последнего обновления
      if (formattedData.length > 0) {
        const lastRow = newData[newData.length - 1];
        const lastTime = lastRow[dataSourceInfo.xAxis];
        try {
          const date = new Date(lastTime);
          if (!isNaN(date.getTime())) {
            setUpdateConfig(prev => ({
              ...prev,
              lastUpdateTime: date
            }));
          }
        } catch (e) {
          console.error('Ошибка парсинга времени:', e);
        }
      }
    }
    
  } catch (error) {
    console.error('Ошибка загрузки данных из БД:', error);
  } finally {
    setIsUpdating(false);
  }
}, [dataSourceInfo, updateConfig.lastUpdateTime]);


// Функция для загрузки данных всех линий из БД (автообновление)
const fetchLinesDataFromDB = useCallback(async () => {
  // Предотвращаем повторный вход
  if (isUpdatingRef.current) {
    return;
  }

  if (!data.lines || data.lines.length === 0) {
    return;
  }

  isUpdatingRef.current = true;

  try {
    setIsUpdating(true);
    
    const loadPromises = data.lines.map(async (line) => {
      if (!line.table || !line.xAxis || !line.yAxis) {
        return { ...line, data: [] };
      }
      
      const sql = `SELECT * FROM ${line.table} ORDER BY 1 DESC LIMIT 200`;
      
      try {
        const response = await fetch('http://localhost:8080/api/execute-query', {
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
      } catch (err) {
        console.error(`Ошибка загрузки данных для линии ${line.name}:`, err);
        return { ...line, data: [] };
      }
    });
    
    const updatedLines = await Promise.all(loadPromises);
    
    // Собираем все точки из всех линий для обратной совместимости
  const allDataPoints = [];
  updatedLines.forEach(line => {
    if (line.data && Array.isArray(line.data)) {
      allDataPoints.push(...line.data);
    }
  });
    
    // Сортируем все точки по времени
    allDataPoints.sort((a, b) => a.time - b.time);
    
    // Обновляем локальное состояние chartData
    if (allDataPoints.length > 0) {
    setChartData(prevData => {
      const prevStr = JSON.stringify(prevData);
      const newStr = JSON.stringify(allDataPoints);
      if (prevStr !== newStr) {
        console.log('Обновлены данные графика');
        return allDataPoints;
      }
      return prevData;
    });
  }
    

        // Проверяем, изменились ли данные, перед обновлением узла
    const newLinesSnapshot = JSON.stringify(updatedLines.map(l => ({
      id: l.id,
      dataLength: l.data?.length,
      lastPoint: l.data?.length > 0 ? l.data[l.data.length - 1] : null
    })));

    // Пропускаем обновление если данные не изменились
    if (prevLinesDataRef.current !== newLinesSnapshot) {
      prevLinesDataRef.current = newLinesSnapshot;

      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === id && node.type === 'chartNode') {
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
    }
    
  } catch (err) {
    console.error('Ошибка автообновления линий:', err);
  } finally {
    setIsUpdating(false);
    isUpdatingRef.current = false;
  }
}, [id, setNodes, data.lines]);

    
useEffect(() => {
  // Используем данные из props
  if (data.initialData && Array.isArray(data.initialData) && data.initialData.length > 0) {
    console.log('Обновление графика новыми данными:', data.initialData.length, 'точек');
    console.log("initialData ", data.initialData.length)
    setChartData(data.initialData);
  }
  
  if (data.lines && Array.isArray(data.lines) && data.lines.length > 0) {
    const allPoints = [];
    data.lines.forEach(line => {
      if (line.data && Array.isArray(line.data)) {
        allPoints.push(...line.data);
      }
    });
    if (allPoints.length > 0) {
      allPoints.sort((a, b) => a.time - b.time);
      setChartData(allPoints);
    }
  }

  if (data.dataSourceInfo) {
    setDataSourceInfo(data.dataSourceInfo);
  }
  if (data.dataSourceInfo && data.dataSourceInfo.yScaleMode) {
    setYScaleMode(data.dataSourceInfo.yScaleMode);
  }
  if (data.series) setChartSeries(data.series);
  
  // Обработка дополнительных серий
  if (data.additionalSeries && Array.isArray(data.additionalSeries)) {
    setAdditionalSeries(data.additionalSeries);
  }

  if (data.width && data.height) {
    setNodeSize({ width: data.width, height: data.height });
  }
  
  setIntervalInput(updateConfig.interval.toString());
}, [data.initialData, data.updateTimestamp, data.series, data.width, data.height, data.dataSourceInfo, data.additionalSeries, data.lines, id]);

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
    
    if (!fetchFunction) {
      return;
    }
    
    // Немедленный первый запрос
    fetchFunction();
    
    // Запускаем интервал
    const interval = setInterval(() => {
      fetchFunction();
    }, updateConfig.interval);
    
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
}, [updateConfig.isAutoUpdate, updateConfig.interval]);


  // Тоггл автоматического обновления
  const toggleAutoUpdate = useCallback(() => {
    setActiveGraphUpdate(true)
    const newState = !updateConfig.isAutoUpdate;
    setUpdateConfig(prev => ({
      ...prev,
      isAutoUpdate: newState
    }));
    
    if (newState && dataSourceInfo) {
      console.log('Автообновление включено, интервал:', updateConfig.interval, 'мс');
    } else {
      console.log('Автообновление выключено');
    }
  }, [updateConfig.isAutoUpdate, updateConfig.interval, dataSourceInfo]);

  // Prevent mouse events from reaching ReactFlow
  const handleMouseDown = useCallback((e) => {
    // Stop propagation to prevent ReactFlow from capturing the event
    e.stopPropagation();
  }, []);

  const handleMouseUp = useCallback((e) => {
    e.stopPropagation();
  }, []);

  const handleMouseMove = useCallback((e) => {
    e.stopPropagation();
  }, []);

  const handleWheel = useCallback((e) => {
    // Allow wheel events for zooming the chart, but prevent propagation
    e.stopPropagation();
  }, []);

  // Handle chart interaction start
  const handleChartInteractionStart = useCallback(() => {
    isChartInteractionRef.current = true;
  }, []);

  // Handle chart interaction end
  const handleChartInteractionEnd = useCallback(() => {
    // Use setTimeout to allow chart interactions to complete
    setTimeout(() => {
      isChartInteractionRef.current = false;
    }, 100);
  }, []);

  // Кастомный ресайзер с квадратными ручками
  const CustomResizer = () => {
    if (!selected) return null;

    const startResize = (e, direction) => {
      e.preventDefault();
      e.stopPropagation();

      const currentNode = getNode(id);
      const startPosX = currentNode.position.x;
      const startPosY = currentNode.position.y;

      const startX = e.clientX;
      const startY = e.clientY;
      const startWidth = nodeSize.width;
      const startHeight = nodeSize.height;
      
      setIsResizing(true);
      document.body.style.cursor = getCursor(direction);

      let animationFrameId = null;
      
    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      
      let newWidth = startWidth;
      let newHeight = startHeight;
      let newPosX = startPosX;
      let newPosY = startPosY;
      
      // В зависимости от направления изменяем размеры И позицию
      switch (direction) {
        case 'right':
          newWidth = Math.max(720, startWidth + deltaX);
          break;
          
        case 'left':
          newWidth = Math.max(720, startWidth - deltaX);
          // КЛЮЧЕВОЕ: сдвигаем позицию влево при увеличении
          if (newWidth !== startWidth) {
            newPosX = startPosX + (startWidth - newWidth);
          }
          break;
          
        case 'bottom':
          newHeight = Math.max(400, startHeight + deltaY);
          break;
          
        case 'top':
          newHeight = Math.max(400, startHeight - deltaY);
          // КЛЮЧЕВОЕ: сдвигаем позицию вверх при увеличении
          if (newHeight !== startHeight) {
            newPosY = startPosY + (startHeight - newHeight);
          }
          break;
          
        case 'top-left':
          newWidth = Math.max(720, startWidth - deltaX);
          newHeight = Math.max(400, startHeight - deltaY);
          // Сдвигаем обе координаты
          if (newWidth !== startWidth) {
            newPosX = startPosX + (startWidth - newWidth);
          }
          if (newHeight !== startHeight) {
            newPosY = startPosY + (startHeight - newHeight);
          }
          break;
          
        case 'top-right':
          newWidth = Math.max(720, startWidth + deltaX);
          newHeight = Math.max(400, startHeight - deltaY);
          // Сдвигаем только Y
          if (newHeight !== startHeight) {
            newPosY = startPosY + (startHeight - newHeight);
          }
          break;
          
        case 'bottom-left':
          newWidth = Math.max(720, startWidth - deltaX);
          newHeight = Math.max(400, startHeight + deltaY);
          // Сдвигаем только X
          if (newWidth !== startWidth) {
            newPosX = startPosX + (startWidth - newWidth);
          }
          break;
          
        case 'bottom-right':
          newWidth = Math.max(720, startWidth + deltaX);
          newHeight = Math.max(400, startHeight + deltaY);
          break;
      }
      
      // Ограничиваем максимальные размеры
      newWidth = Math.min(999999, newWidth);
      newHeight = Math.min(99999, newHeight);
      
      // Отменяем предыдущий запланированный кадр, если он есть
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  
  // Планируем обновление на следующий кадр анимации
  animationFrameId = requestAnimationFrame(() => {
    setNodeSize({ width: newWidth, height: newHeight });
    
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            position: {
              x: newPosX,
              y: newPosY
            },
            data: {
              ...node.data,
              width: newWidth,
              height: newHeight
            }
          };
        }
        return node;
      })
    );
  });
};

const handleMouseUp = () => {
  // Отменяем последний запланированный кадр
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  
  setIsResizing(false);
  document.body.style.cursor = '';
  
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);
};

document.addEventListener('mousemove', handleMouseMove);
document.addEventListener('mouseup', handleMouseUp);
    };

    return (
      <>
        {/* Верхний левый угол */}
        <div
          className="resize-handle-square top-left"
          onMouseDown={(e) => startResize(e, 'top-left')}
        />
        
        {/* Верхний правый угол */}
        <div
          className="resize-handle-square top-right"
          onMouseDown={(e) => startResize(e, 'top-right')}
        />
        
        {/* Нижний левый угол */}
        <div
          className="resize-handle-square bottom-left"
          onMouseDown={(e) => startResize(e, 'bottom-left')}
        />
        
        {/* Нижний правый угол */}
        <div
          className="resize-handle-square bottom-right"
          onMouseDown={(e) => startResize(e, 'bottom-right')}
        />
        
        {/* Верхняя сторона */}
        <div
          className="resize-handle-square top"
          onMouseDown={(e) => startResize(e, 'top')}
        />
        
        {/* Правая сторона */}
        <div
          className="resize-handle-square right"
          onMouseDown={(e) => startResize(e, 'right')}
        />
        
        {/* Нижняя сторона */}
        <div
          className="resize-handle-square bottom"
          onMouseDown={(e) => startResize(e, 'bottom')}

        />
        
        {/* Левая сторона */}
        <div
          className="resize-handle-square left"
          onMouseDown={(e) => startResize(e, 'left')}
        />
      </>
    );
  };

  // Конфигурация графика
  const chartColors = {
    backgroundColor: '#1e1e1e',
    textColor: '#ffffff',
    lineColor: data.lineColor || '#4dabf7',
    gridColor: '#444'
  };

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
        position: 'relative',
        cursor: isResizing ? getCursor('bottom-right') : 'default'
      }}
      onContextMenu={handleContextMenu}
    >
      {/* Квадратные ручки для ресайза */}
      <CustomResizer />
      
      <div className="chart-node-header">
        <div className="chart-node-title">
          <i className="bi bi-bar-chart"></i>
          <EditableTitle 
            value={data.label || 'График'}
            onSave={(newTitle) => {
              // Обновляем данные узла
              setNodes((nds) =>
                nds.map((node) => {
                  if (node.id === id) {
                    return {
                      ...node,
                      data: {
                        ...node.data,
                        label: newTitle
                      }
                    };
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
        
        {/* Кнопки управления обновлением данных */}
        <div className="chart-update-controls">
          {/* Основная кнопка обновления */}
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
      

      <div 
        className="chart-node-content nodrag"
        ref={chartWrapperRef}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onWheel={handleWheel}
        style={{ cursor: 'crosshair', userSelect: 'none' }}
      >
        {Chart && (
          <div
            onMouseEnter={() => {
              // Prevent ReactFlow panning when mouse enters chart area
              if (chartWrapperRef.current) {
                chartWrapperRef.current.style.cursor = 'default';
              }
            }}
            onMouseLeave={() => {
              // Reset cursor when leaving chart area
              if (chartWrapperRef.current) {
                chartWrapperRef.current.style.cursor = '';
              }
            }}
          >
            <Chart 
              activeGraphUpdate={activeGraphUpdate}
              chartData={chartData}
              lines ={data.lines}
              additionalSeries={additionalSeries}
              width={nodeSize.width}
              height={nodeSize.height - 50}
              yScaleMode={yScaleMode}
              isAutoUpdate={updateConfig.isAutoUpdate}
            />
          </div>
        )}
      </div>
    </div>
  );
};

// Кастомный узел для источника данных
const DataSourceNode = ({ data, isConnectable, selected, id }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [dataCount, setDataCount] = useState(1000);
  const [intervalId, setIntervalId] = useState(null);
  const [nodeSize, setNodeSize] = useState({ width: 300, height: 200 });

  useEffect(() => {
    if (data.width && data.height) {
      setNodeSize({ width: data.width, height: data.height });
    }
  }, [data.width, data.height]);

  useEffect(() => {
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [intervalId]);

  // Предотвращение контекстного меню
  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div 
      className="data-source-node"
      style={{ 
        width: nodeSize.width,
        height: nodeSize.height,
        minWidth: 200,
        minHeight: 150
      }}
      onContextMenu={handleContextMenu}
    >
      {selected && (
        <NodeResizer
          nodeId={id}
          minWidth={200}
          minHeight={150}
          maxWidth={500}
          maxHeight={400}
          lineClassName="resize-line"
          handleClassName="resize-handle"
          color="#4dabf7"
          isVisible={selected}
          onResize={(event, params) => {
            setNodeSize({
              width: params.width,
              height: params.height
            });
          }}
        />
      )}
      <div className='data-source-header'>
        <h6>
          Доп. Блок 1
        </h6>
        <input
        style={{
              width: nodeSize.width,
              height: nodeSize.height,
              minWidth: 200,
              minHeight: 80
        }}>

        </input>
      </div>
    </div>
  );
};

// Кастомный узел для обработки данных
const ProcessorNode = ({ data, selected, id }) => {
  const [isActive, setIsActive] = useState(true);
  const [processedCount, setProcessedCount] = useState(0);
  const [nodeSize, setNodeSize] = useState({ width: 300, height: 200 });

  
  useEffect(() => {
    if (data.width && data.height) {
      setNodeSize({ width: data.width, height: data.height });
    }
  }, [data.width, data.height]);

  const handleToggle = useCallback(() => {
    setIsActive(!isActive);
  }, [isActive]);

  // Предотвращение контекстного меню
  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div 
      className="processor-node"
      style={{ 
        width: nodeSize.width,
        height: nodeSize.height,
        minWidth: 200,
        minHeight: 150
      }}
      onContextMenu={handleContextMenu}
    >
      {selected && (
        <NodeResizer
          nodeId={id}
          minWidth={200}
          minHeight={150}
          maxWidth={500}
          maxHeight={400}
          lineClassName="resize-line"
          handleClassName="resize-handle"
          color="#4dabf7"
          isVisible={selected}
          onResize={(event, params) => {
            setNodeSize({
              width: params.width,
              height: params.height
            });
          }}
        />
      )}
      
      <div className="processor-header">
        <div className="processor-icon">
          <i className={`bi ${data.icon || 'bi-gear'}`}></i>
        </div>
        <div className="processor-info">
          <h6>{data.label || 'Обработчик'}</h6>
          <small className="text-muted">{data.description || 'Обрабатывает данные'}</small>
        </div>
        <div className="processor-toggle">
          <div className="form-check form-switch">
            <input
              className="form-check-input"
              type="checkbox"
              checked={isActive}
              onChange={handleToggle}
            />
          </div>
        </div>
      </div>
      
      <div className="processor-body">
        <div className="processor-stats">
          <div className="stat-item">
            <span className="stat-label">Обработано:</span>
            <span className="stat-value">{processedCount}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Статус:</span>
            <span className={`stat-value ${isActive ? 'text-success' : 'text-danger'}`}>
              {isActive ? 'Активен' : 'Неактивен'}
            </span>
          </div>
        </div>
        
        {data.parameters && (
          <div className="processor-params">
            <small className="text-muted d-block mb-1">Параметры:</small>
            {Object.entries(data.parameters).map(([key, value]) => (
              <div key={key} className="param-item">
                <span className="param-key">{key}:</span>
                <span className="param-value">{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="size-indicator">
        {Math.round(nodeSize.width)}×{Math.round(nodeSize.height)}
      </div>
    </div>
  );
};

// Кастомный узел для радиального графика векторов
const RadialChartNode = ({ data, isConnectable, selected, id }) => {
  const { getNode, setNodes } = useReactFlow();
  const [nodeSize, setNodeSize] = useState({ width: data.width || 800, height: data.height || 800 });
  const [isResizing, setIsResizing] = useState(false);
  const [updateConfig, setUpdateConfig] = useState({
    interval: 1000,
    isAutoUpdate: false,
    lastUpdateTime: null
  });
  const [pollingIntervalId, setPollingIntervalId] = useState(null);
  const [currentLines, setCurrentLines] = useState([]);
  const nodeRef = useRef(null);
  const isUpdatingRef = useRef(false);

  // Функция для получения курсора в зависимости от направления
  const getCursor = (direction) => {
    switch (direction) {
      case 'top-left':
      case 'bottom-right': return 'nwse-resize';
      case 'top-right':
      case 'bottom-left': return 'nesw-resize';
      case 'top':
      case 'bottom':      return 'ns-resize';
      case 'left':
      case 'right':       return 'ew-resize';
      default:            return 'default';
    }
  };

  // Обновление размера из data
  useEffect(() => {
    if (data.width && data.height) {
      setNodeSize({ width: data.width, height: data.height });
    }
  }, [data.width, data.height]);

  // Обновление линий из data (приходит от Sidebar)
  useEffect(() => {
    if (data.lines && Array.isArray(data.lines)) {
      setCurrentLines(data.lines);
    }
  }, [data.lines, data.updateTimestamp]);

  // Функция для загрузки данных всех линий из БД (автообновление)
  const fetchLinesDataFromDB = useCallback(async () => {
    if (isUpdatingRef.current || !currentLines || currentLines.length === 0) return;

    isUpdatingRef.current = true;
    try {
      const loadPromises = currentLines.map(async (line) => {
        if (!line.table || !line.angleAxis || !line.magnitudeAxis) return { ...line, data: [] };
        
        const sql = `SELECT * FROM ${line.table} ORDER BY 1 DESC LIMIT 1`;
        
        const response = await fetch('http://localhost:8080/api/execute-query', {
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
    setUpdateConfig(prev => ({
      ...prev,
      isAutoUpdate: !prev.isAutoUpdate
    }));
  }, []);

  // Кастомный ресайзер с квадратными ручками
  const CustomResizer = () => {
    if (!selected) return null;

    const startResize = (e, direction) => {
      e.preventDefault();
      e.stopPropagation();

      const currentNode = getNode(id);
      const startPosX = currentNode.position.x;
      const startPosY = currentNode.position.y;

      const startX = e.clientX;
      const startY = e.clientY;
      const startWidth = nodeSize.width;
      const startHeight = nodeSize.height;
      
      setIsResizing(true);
      document.body.style.cursor = getCursor(direction);

      let animationFrameId = null;
      
      const handleMouseMove = (moveEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;
        
        let newWidth = startWidth;
        let newHeight = startHeight;
        let newPosX = startPosX;
        let newPosY = startPosY;
        
        // Минимальные размеры для радиального графика (квадрат 600x600)
        const minSize = 600;
        
        switch (direction) {
          case 'right':
            newWidth = Math.max(minSize, startWidth + deltaX);
            break;
            
          case 'left':
            newWidth = Math.max(minSize, startWidth - deltaX);
            if (newWidth !== startWidth) {
              newPosX = startPosX + (startWidth - newWidth);
            }
            break;
            
          case 'bottom':
            newHeight = Math.max(minSize, startHeight + deltaY);
            break;
            
          case 'top':
            newHeight = Math.max(minSize, startHeight - deltaY);
            if (newHeight !== startHeight) {
              newPosY = startPosY + (startHeight - newHeight);
            }
            break;
            
          case 'top-left':
            newWidth = Math.max(minSize, startWidth - deltaX);
            newHeight = Math.max(minSize, startHeight - deltaY);
            if (newWidth !== startWidth) {
              newPosX = startPosX + (startWidth - newWidth);
            }
            if (newHeight !== startHeight) {
              newPosY = startPosY + (startHeight - newHeight);
            }
            break;
            
          case 'top-right':
            newWidth = Math.max(minSize, startWidth + deltaX);
            newHeight = Math.max(minSize, startHeight - deltaY);
            if (newHeight !== startHeight) {
              newPosY = startPosY + (startHeight - newHeight);
            }
            break;
            
          case 'bottom-left':
            newWidth = Math.max(minSize, startWidth - deltaX);
            newHeight = Math.max(minSize, startHeight + deltaY);
            if (newWidth !== startWidth) {
              newPosX = startPosX + (startWidth - newWidth);
            }
            break;
            
          case 'bottom-right':
            newWidth = Math.max(minSize, startWidth + deltaX);
            newHeight = Math.max(minSize, startHeight + deltaY);
            break;
        }
        
        // Ограничиваем максимальные размеры
        newWidth = Math.min(2000, newWidth);
        newHeight = Math.min(2000, newHeight);
        
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
        
        animationFrameId = requestAnimationFrame(() => {
          setNodeSize({ width: newWidth, height: newHeight });
          
          setNodes((nds) =>
            nds.map((node) => {
              if (node.id === id) {
                return {
                  ...node,
                  position: {
                    x: newPosX,
                    y: newPosY
                  },
                  data: {
                    ...node.data,
                    width: newWidth,
                    height: newHeight
                  }
                };
              }
              return node;
            })
          );
        });
      };

      const handleMouseUp = () => {
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
        
        setIsResizing(false);
        document.body.style.cursor = '';
        
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    };

    return (
      <>
        {/* Угловые ручки */}
        <div
          className="resize-handle-square top-left"
          onMouseDown={(e) => startResize(e, 'top-left')}
          title="Изменить размер"
        />
        <div
          className="resize-handle-square top-right"
          onMouseDown={(e) => startResize(e, 'top-right')}
          title="Изменить размер"
        />
        <div
          className="resize-handle-square bottom-left"
          onMouseDown={(e) => startResize(e, 'bottom-left')}
          title="Изменить размер"
        />
        <div
          className="resize-handle-square bottom-right"
          onMouseDown={(e) => startResize(e, 'bottom-right')}
          title="Изменить размер"
        />
        
        {/* Сторонние ручки */}
        <div
          className="resize-handle-square top"
          onMouseDown={(e) => startResize(e, 'top')}
          title="Изменить высоту"
        />
        <div
          className="resize-handle-square right"
          onMouseDown={(e) => startResize(e, 'right')}
          title="Изменить ширину"
        />
        <div
          className="resize-handle-square bottom"
          onMouseDown={(e) => startResize(e, 'bottom')}
          title="Изменить высоту"
        />
        <div
          className="resize-handle-square left"
          onMouseDown={(e) => startResize(e, 'left')}
          title="Изменить ширину"
        />
      </>
    );
  };

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
      <CustomResizer />
      
      <div className="chart-node-header">
        <div className="chart-node-title">
          <i className="bi bi-radar"></i>
          <EditableTitle 
            value={data.label || 'Радиальный график'}
            onSave={(newTitle) => {
              setNodes((nds) =>
                nds.map((node) => {
                  if (node.id === id) {
                    return { 
                      ...node, 
                      data: { 
                        ...node.data, 
                        label: newTitle 
                      } 
                    };
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

// Зарегистрируем типы узлов
const nodeTypes = {
  chartNode: ChartNode,
  dataSourceNode: DataSourceNode,
  processorNode: ProcessorNode,
  radialChartNode: RadialChartNode
};

// Основной компонент графа
const Graph = () => {
  const { isDark } = useTheme();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [rfInstance, setRfInstance] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [nodeCounter, setNodeCounter] = useState(1);
  const { updateNode } = useReactFlow();

  // Глобальная функция для обновления данных узла
  useEffect(() => {
    // Экспортируем функцию для доступа из Sidebar
    window.updateNodeData = (nodeId, payload) => {
  setNodes((nds) => 
    nds.map((node) => {
      if (node.id === nodeId && (node.type === 'chartNode' || node.type === 'radialChartNode')) {
        return {
          ...node,
          data: {
            ...node.data,
            lines: payload.lines || [], // Общие линии для всех
            updateTimestamp: payload.timestamp || Date.now()
          }
        };
      }
      return node;
    })
  );
};
//     window.updateNodeData = (nodeId, payload) => {
//   setNodes((nds) => 
//     nds.map((node) => {
//       if (node.id === nodeId && node.type === 'chartNode') {
//         return {
//           ...node,
//           data: {
//             ...node.data,
//             initialData: payload.chartData || payload,  // Поддержка старого формата
//             dataSourceInfo: payload.sourceInfo,
//             additionalSeries: payload.additionalSeries || [], // дополнительные серии
//             lines: payload.lines || [],
//             updateTimestamp: payload.timestamp || Date.now()  // Для принудительного обновления
//           }
//         };
//       }
//       if (node.id === nodeId && node.type === 'radialChartNode') {
//         return {
//           ...node,
//           data: {
//             ...node.data,
//             initialVectorData: payload.vectorData || [],
//             dataSourceInfo: payload.sourceInfo,
//             updateTimestamp: payload.timestamp || Date.now()
//           }
//         };
//       }
//       return node;
//     })
//   );
// };
    
    return () => {
      delete window.updateNodeData;
    };
  }, [setNodes]);

  // Обработчик соединений
  const onConnect = useCallback(
    (params) => {
      const newEdge = {
        ...params,
        id: `edge-${Date.now()}`,
        animated: true,
        style: { stroke: '#666', strokeWidth: 2 }
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges]
  );

  // Обработчик выбора узла
  const onNodeClick = useCallback((event, node) => {
    setSelectedNode(node);
  }, []);

  // Обработчик изменения размеров узла
  const onNodeResize = useCallback((event, params) => {
    const { id, width, height } = params;
    
    setNodes((nds) => 
      nds.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            style: {
              ...node.style,
              width,
              height
            },
            data: {
              ...node.data,
              width,
              height
            }
          };
        }
        return node;
      })
    );
  }, [setNodes]);

  // Добавление нового узла графика
  const addChartNode = useCallback(() => {
    const newNodeId = `${nodeCounter}`;
    const newNode = {
      id: newNodeId,
      type: 'chartNode',
      dragHandle: '.chart-node-header',
      position: { 
        x: Math.random() * 500 + 100, 
        y: Math.random() * 300 + 50 
      },
      data: {
        label: `График ${nodeCounter}`,
        chartType: 'linear',
        lineColor: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
        realTime: true,
        initialData: [],
        series: [],
        width: 1200,
        height: 600
      }
    };
    
    setNodes((nds) => [...nds, newNode]);
    setNodeCounter((prev) => prev + 1);
  }, [nodeCounter, setNodes]);

  // Добавление нового радиального графика
  const addRadialChartNode = useCallback(() => {
    const newNodeId = `${nodeCounter}`;
    const newNode = {
      id: newNodeId,
      type: 'radialChartNode',
      dragHandle: '.chart-node-header',
      position: { 
        x: Math.random() * 500 + 100, 
        y: Math.random() * 300 + 50 
      },
      data: {
        label: `Радиальный график ${nodeCounter}`,
        chartType: 'radial',
        initialVectorData: [],
        width: 800,
        height: 800
      }
    };
    
    setNodes((nds) => [...nds, newNode]);
    setNodeCounter((prev) => prev + 1);
  }, [nodeCounter, setNodes]);

  // Удаление выбранного узла
  const deleteSelectedNode = useCallback(() => {
    if (selectedNode) {
      setNodes((nds) => nds.filter((node) => node.id !== selectedNode.id));
      setEdges((eds) => eds.filter(
        (edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id
      ));
      setSelectedNode(null);
    }
  }, [selectedNode, setNodes, setEdges]);

  // Сброс графа
  const resetGraph = useCallback(() => {
    if (window.confirm('Вы уверены, что хотите сбросить граф?')) {
      setNodes([]);
      setEdges([]);
      setSelectedNode(null);
      setNodeCounter(1);
    }
  }, [setNodes, setEdges]);

  // Получение информации о графе
  const getGraphInfo = useCallback(() => {
    return {
      nodes: nodes.length,
      edges: edges.length,
      charts: nodes.filter(n => n.type === 'chartNode').length,
      radialCharts: nodes.filter(n => n.type === 'radialChartNode').length,
      sources: nodes.filter(n => n.type === 'dataSourceNode').length,
      processors: nodes.filter(n => n.type === 'processorNode').length
    };
  }, [nodes, edges]);

  const graphInfo = getGraphInfo();

  // Обработчик изменения узлов (включая ресайз)
  const onNodesChangeHandler = useCallback(
    (changes) => {
      changes.forEach(change => {
        if (change.type === 'resize') {
          const node = nodes.find(n => n.id === change.id);
          if (node) {
            onNodeResize(null, {
              id: change.id,
              width: change.width || node.style?.width || 300,
              height: change.height || node.style?.height || 200
            });
          }
        }
      });
      onNodesChange(changes);
    },
    [nodes, onNodesChange, onNodeResize]
  );

  return (
    <div className="graph-container">
      {/* Sidebar */}
      <Sidebar
        width={300}
        onAddChartNode={addChartNode}
        onAddRadialChartNode={addRadialChartNode}
        onDeleteSelectedNode={deleteSelectedNode}
        onResetGraph={resetGraph}
        selectedNode={selectedNode}
        graphInfo={graphInfo}
      />
      
      {/* React Flow */}
      <div className="reactflow-wrapper">
        <ReactFlow
          colorMode={isDark ? 'dark' : 'light'}
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChangeHandler}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          onInit={setRfInstance}
          fitView
          attributionPosition="bottom-right"
          onlyRenderVisibleElements={false}
          nodesDraggable={true}
          nodesConnectable={true}
          elementsSelectable={true}
          minZoom={0.1}
          maxZoom={2}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          nodeOrigin={[0, 0]}
          snapToGrid={false}
          snapGrid={[15, 15]}
          proOptions={{ hideAttribution: false }}
          onPaneContextMenu={(e) => e.preventDefault()}
          onNodeContextMenu={(e, node) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <Controls />
          <Background variant="dots" gap={12} size={1.3} />
        </ReactFlow>
      </div>
    </div>
  );
};

// Обертка с провайдером React Flow
const GraphWrapper = () => {
  return (
    <ReactFlowProvider>
      <Graph />
    </ReactFlowProvider>
  );
};

export default GraphWrapper;