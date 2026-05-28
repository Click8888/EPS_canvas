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
import globalDataStream from './components/GlobalDataStream';

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
  const [additionalSeries, setAdditionalSeries] = useState([]);
  const [nodeSize, setNodeSize] = useState({ width: 600, height: 1200 });
  const [isResizing, setIsResizing] = useState(false);
  const [dataSourceInfo, setDataSourceInfo] = useState(null);
  const [yScaleMode, setYScaleMode] = useState('dynamic');
  const [updateConfig, setUpdateConfig] = useState({
    interval: 20, // Интервал обновления для графика
    isAutoUpdate: false, // Автоматическое обновление
    lastUpdateTime: null
  });
  const nodeRef = useRef(null);
  const chartWrapperRef = useRef(null);
  const subscriptionIdRef = useRef(null); // ID подписки в глобальном стриме
  const [localLines, setLocalLines] = useState([]); // Локальное состояние для линий
  
  // Flag to track if we're interacting with the chart
  const isChartInteractionRef = useRef(false);
  
  const dpr = window.devicePixelRatio || 1;

  // Получение курсора для ресайза
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

  // Синхронизация внешних lines с локальным состоянием
  useEffect(() => {
    if (data.lines && Array.isArray(data.lines) && data.lines.length > 0) {
      setLocalLines(prevLines => {
        // Сохраняем существующие данные при обновлении метаданных
        const existingDataMap = new Map(prevLines.map(l => [l.id, l.data]));
        const newLines = data.lines.map(line => ({
          ...line,
          data: existingDataMap.get(line.id) || line.data || []
        }));
        return newLines;
      });
    }
  }, [data.lines]);

  // Обработка начальных данных из props
  useEffect(() => {
    if (data.initialData && Array.isArray(data.initialData) && data.initialData.length > 0) {
      console.log('Обновление графика новыми данными:', data.initialData.length, 'точек');
      setChartData(data.initialData);
    }
    
    if (data.dataSourceInfo) {
      setDataSourceInfo(data.dataSourceInfo);
    }
    if (data.dataSourceInfo && data.dataSourceInfo.yScaleMode) {
      setYScaleMode(data.dataSourceInfo.yScaleMode);
    }
    
    if (data.additionalSeries && Array.isArray(data.additionalSeries)) {
      setAdditionalSeries(data.additionalSeries);
    }

    if (data.width && data.height) {
      setNodeSize({ width: data.width, height: data.height });
    }
  }, [data.initialData, data.updateTimestamp, data.width, data.height, data.dataSourceInfo, data.additionalSeries]);

  // ПОДПИСКА НА ГЛОБАЛЬНЫЙ СТРИМ ДАННЫХ
  useEffect(() => {
    // Если нет линий или автообновление выключено - отписываемся
    if (!localLines || localLines.length === 0 || !updateConfig.isAutoUpdate) {
      if (subscriptionIdRef.current) {
        globalDataStream.unsubscribe(subscriptionIdRef.current);
        subscriptionIdRef.current = null;
      }
      return;
    }

    // Проверяем, что у линий есть необходимые параметры
    const validLines = localLines.filter(line => line.table && line.xAxis && line.yAxis);
    if (validLines.length === 0) return;

    console.log(`[ChartNode ${id}] Подписка на глобальный стрим для ${validLines.length} линий, интервал: ${updateConfig.interval}ms`);

    // Подписываемся на глобальный стрим
    const subId = globalDataStream.subscribe(
      id, // Используем ID узла как идентификатор
      validLines,
      updateConfig.interval,
      (updatedLines, timestamp) => {
        console.log(`[ChartNode ${id}] Получены обновленные данные от глобального стрима, ${updatedLines.length} линий`);
        
        // Собираем все точки для графика
        const allPoints = [];
        updatedLines.forEach(line => {
          if (line.data && Array.isArray(line.data)) {
            allPoints.push(...line.data);
          }
        });
        allPoints.sort((a, b) => a.time - b.time);
        setChartData(allPoints);
        
        // Обновляем локальное состояние линий
        setLocalLines(prevLines => {
          const updatedLinesMap = new Map(updatedLines.map(l => [l.id, l]));
          const mergedLines = prevLines.map(line => {
            if (updatedLinesMap.has(line.id)) {
              return { ...line, data: updatedLinesMap.get(line.id).data };
            }
            return line;
          });
          return mergedLines;
        });
        
        // Обновляем узел в React Flow
        setNodes((nds) =>
          nds.map((node) => {
            if (node.id === id && node.type === 'chartNode') {
              return {
                ...node,
                data: {
                  ...node.data,
                  lines: updatedLines,
                  updateTimestamp: timestamp
                }
              };
            }
            return node;
          })
        );
      }
    );
    
    subscriptionIdRef.current = subId;
    
    // Отписка при размонтировании или изменении зависимостей
    return () => {
      if (subscriptionIdRef.current) {
        console.log(`[ChartNode ${id}] Отписка от глобального стрима`);
        globalDataStream.unsubscribe(subscriptionIdRef.current);
        subscriptionIdRef.current = null;
      }
    };
  }, [id, localLines, updateConfig.isAutoUpdate, updateConfig.interval, setNodes]);

  // Тоггл автоматического обновления
  const toggleAutoUpdate = useCallback(() => {
    const newState = !updateConfig.isAutoUpdate;
    setUpdateConfig(prev => ({
      ...prev,
      isAutoUpdate: newState
    }));
    
    console.log(`[ChartNode ${id}] Автообновление ${newState ? 'включено' : 'выключено'}, интервал: ${updateConfig.interval}мс`);
  }, [updateConfig.isAutoUpdate, updateConfig.interval, id]);

  // Изменение интервала обновления
  const changeUpdateInterval = useCallback((newInterval) => {
    setUpdateConfig(prev => ({
      ...prev,
      interval: newInterval
    }));
    
    // Если есть активная подписка, обновляем интервал в глобальном стриме
    if (subscriptionIdRef.current && updateConfig.isAutoUpdate) {
      globalDataStream.updateSubscriptionInterval(subscriptionIdRef.current, newInterval);
    }
  }, [updateConfig.isAutoUpdate]);

  // Prevent mouse events from reaching ReactFlow
  const handleMouseDown = useCallback((e) => {
    e.stopPropagation();
  }, []);

  const handleMouseUp = useCallback((e) => {
    e.stopPropagation();
  }, []);

  const handleMouseMove = useCallback((e) => {
    e.stopPropagation();
  }, []);

  const handleWheel = useCallback((e) => {
    e.stopPropagation();
  }, []);

  // Handle chart interaction start
  const handleChartInteractionStart = useCallback(() => {
    isChartInteractionRef.current = true;
  }, []);

  // Handle chart interaction end
  const handleChartInteractionEnd = useCallback(() => {
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
        
        switch (direction) {
          case 'right':
            newWidth = Math.max(720, startWidth + deltaX);
            break;
            
          case 'left':
            newWidth = Math.max(720, startWidth - deltaX);
            if (newWidth !== startWidth) {
              newPosX = startPosX + (startWidth - newWidth);
            }
            break;
            
          case 'bottom':
            newHeight = Math.max(400, startHeight + deltaY);
            break;
            
          case 'top':
            newHeight = Math.max(400, startHeight - deltaY);
            if (newHeight !== startHeight) {
              newPosY = startPosY + (startHeight - newHeight);
            }
            break;
            
          case 'top-left':
            newWidth = Math.max(720, startWidth - deltaX);
            newHeight = Math.max(400, startHeight - deltaY);
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
            if (newHeight !== startHeight) {
              newPosY = startPosY + (startHeight - newHeight);
            }
            break;
            
          case 'bottom-left':
            newWidth = Math.max(720, startWidth - deltaX);
            newHeight = Math.max(400, startHeight + deltaY);
            if (newWidth !== startWidth) {
              newPosX = startPosX + (startWidth - newWidth);
            }
            break;
            
          case 'bottom-right':
            newWidth = Math.max(720, startWidth + deltaX);
            newHeight = Math.max(400, startHeight + deltaY);
            break;
        }
        
        newWidth = Math.min(999999, newWidth);
        newHeight = Math.min(99999, newHeight);
        
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

      const handleMouseUpEvent = () => {
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
        
        setIsResizing(false);
        document.body.style.cursor = '';
        
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUpEvent);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUpEvent);
    };

    return (
      <>
        <div className="resize-handle-square top-left" onMouseDown={(e) => startResize(e, 'top-left')} />
        <div className="resize-handle-square top-right" onMouseDown={(e) => startResize(e, 'top-right')} />
        <div className="resize-handle-square bottom-left" onMouseDown={(e) => startResize(e, 'bottom-left')} />
        <div className="resize-handle-square bottom-right" onMouseDown={(e) => startResize(e, 'bottom-right')} />
        <div className="resize-handle-square top" onMouseDown={(e) => startResize(e, 'top')} />
        <div className="resize-handle-square right" onMouseDown={(e) => startResize(e, 'right')} />
        <div className="resize-handle-square bottom" onMouseDown={(e) => startResize(e, 'bottom')} />
        <div className="resize-handle-square left" onMouseDown={(e) => startResize(e, 'left')} />
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
      <CustomResizer />
      
      <div className="chart-node-header">
        <div className="chart-node-title">
          <i className="bi bi-bar-chart"></i>
          <EditableTitle 
            value={data.label || 'График'}
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
            disabled={!localLines || localLines.length === 0}
            title={(localLines && localLines.length > 0) ? 
              (updateConfig.isAutoUpdate ? "Остановить автообновление" : "Включить автообновление из БД") : 
              "Сначала добавьте линии через Sidebar"}
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
        <div
          onMouseEnter={() => {
            if (chartWrapperRef.current) {
              chartWrapperRef.current.style.cursor = 'default';
            }
          }}
          onMouseLeave={() => {
            if (chartWrapperRef.current) {
              chartWrapperRef.current.style.cursor = '';
            }
          }}
        >
          <Chart 
            activeGraphUpdate={updateConfig.isAutoUpdate}
            chartData={chartData}
            lines={localLines}
            additionalSeries={additionalSeries}
            width={nodeSize.width}
            height={nodeSize.height - 50}
            yScaleMode={yScaleMode}
            isAutoUpdate={updateConfig.isAutoUpdate}
          />
        </div>
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
    interval: 20,
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

  useEffect(() => {
    // Экспортируем функцию для обновления интервала
    window.updateNodeInterval = (nodeId, newInterval) => {
      // Находим подписку и обновляем
      // (позже реализуем маппинг nodeId -> subscriptionId)
      console.log(`[Graph] Обновление интервала для узла ${nodeId} на ${newInterval}ms`);
      // TODO: реализовать обновление интервала в глобальном стриме
    };
    
    return () => {
      delete window.updateNodeInterval;
    };
  }, []);

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