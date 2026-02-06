import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactFlow, {
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
} from 'reactflow';
import 'reactflow/dist/style.css';
import './Graph.css';
import Sidebar from './components/Sidebar';
import Chart from './components/Chart';

// Кастомный узел для графика
const ChartNode = ({ data, isConnectable, selected, id }) => {
  const [chartData, setChartData] = useState([]);
  const [activeGraphUpdate, setActiveGraphUpdate] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [chartSeries, setChartSeries] = useState([]);
  const [nodeSize, setNodeSize] = useState({ width: 400, height: 300 });
  const [isResizing, setIsResizing] = useState(false);
  const [updateConfig, setUpdateConfig] = useState({
    interval: 20, // Интервал обновления из БД в мс
    isAutoUpdate: false, // Автоматическое обновление
    isSettingsOpen: false,
    lastUpdateTime: null // Время последнего обновления
  });
  const [intervalInput, setIntervalInput] = useState("20");
  const [dataSourceInfo, setDataSourceInfo] = useState(null);
  const [pollingIntervalId, setPollingIntervalId] = useState(null);
  const [wsConnection, setWsConnection] = useState(null);
  
  const nodeRef = useRef(null);
  const updateIntervalRef = useRef(null);
  const settingsPanelRef = useRef(null);
  
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
        const lastTime = updateConfig.lastUpdateTime.toISOString().slice(0, 19).replace('T', ' ');
        sql += ` WHERE ${dataSourceInfo.xAxis} > '${lastTime}'`;
      }
      
      sql += ` ORDER BY ${dataSourceInfo.xAxis} ASC`;

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
        console.log(`Получено ${newData.length} новых записей из БД`);
        
        // Форматируем данные для графика
        const formattedData = newData
          .filter(row => row[dataSourceInfo.xAxis] != null && row[dataSourceInfo.yAxis] != null)
          .map((row, index) => {
            const xValue = row[dataSourceInfo.xAxis];
            const yValue = parseFloat(row[dataSourceInfo.yAxis]);
            
            // Преобразуем время
            let timeValue;
            if (xValue instanceof Date) {
              timeValue = xValue.getTime() / 1000;
            } else if (typeof xValue === 'string') {
              // Пытаемся разобрать строку времени
              const timeMatch = xValue.match(/(\d{1,2}):(\d{1,2}):(\d{1,2})(?:\.(\d+))?/);
              if (timeMatch) {
                const hours = parseInt(timeMatch[1]) || 0;
                const minutes = parseInt(timeMatch[2]) || 0;
                const seconds = parseInt(timeMatch[3]) || 0;
                const milliseconds = timeMatch[4] ? parseInt(timeMatch[4].substring(0, 3)) : 0;
                timeValue = hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
              } else {
                // Пытаемся преобразовать в timestamp
                const date = new Date(xValue);
                if (!isNaN(date.getTime())) {
                  timeValue = date.getTime() / 1000;
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
        
        // Обновляем данные графика - добавляем новые точки к существующим
        setChartData(prev => {
          // Проверяем только самые новые точки на дубликаты
          const existingTimes = new Set();
          const lastExistingPoints = prev.slice(-formattedData.length);
          lastExistingPoints.forEach(p => existingTimes.add(p.time));
          
          // Фильтруем новые данные, оставляем только те, которых еще нет
          const uniqueNewData = formattedData.filter(newPoint => {
            const hasDuplicate = Array.from(existingTimes).some(existingTime => 
              Math.abs(existingTime - newPoint.time) < 0.001
            );
            return !hasDuplicate;
          });
          
          // Если есть уникальные новые данные, добавляем их
          if (uniqueNewData.length > 0) {
            const updatedData = [...prev, ...uniqueNewData];
            // Сортируем по времени
            updatedData.sort((a, b) => a.time - b.time);
            return updatedData;
          }
          
          return prev;
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


  // Инициализация данных графика
  useEffect(() => {
    // Проверяем данные из localStorage
    const savedData = localStorage.getItem(`chartData_${id}`);
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        setChartData(parsedData.data || []);
        setDataSourceInfo(parsedData.params || null);
        
        // Устанавливаем время последнего обновления
        if (parsedData.data && parsedData.data.length > 0) {
          const lastData = parsedData.data[parsedData.data.length - 1];
          if (lastData.originalTime) {
            try {
              const date = new Date(lastData.originalTime);
              if (!isNaN(date.getTime())) {
                setUpdateConfig(prev => ({
                  ...prev,
                  lastUpdateTime: date
                }));
              }
            } catch (e) {
              console.error('Ошибка установки времени:', e);
            }
          }
        }
      } catch (e) {
        console.error('Ошибка загрузки сохраненных данных:', e);
      }
    }
    
    // Используем данные из props
    if (data.initialData && Array.isArray(data.initialData) && data.initialData.length > 0) {
      setChartData(data.initialData);
      
      // Сохраняем в localStorage
      localStorage.setItem(`chartData_${id}`, JSON.stringify({
        data: data.initialData,
        params: data.dataSourceInfo || null
      }));
    }
    
    if (data.dataSourceInfo) {
      setDataSourceInfo(data.dataSourceInfo);
    }
    
    if (data.series) setChartSeries(data.series);
    if (data.width && data.height) {
      setNodeSize({ width: data.width, height: data.height });
    }
    
    setIntervalInput(updateConfig.interval.toString());
  }, [data.initialData, data.series, data.width, data.height, data.dataSourceInfo, id]);

  // Запуск/остановка опроса БД
  useEffect(() => {
    if (updateConfig.isAutoUpdate && dataSourceInfo) {
      // Первый запрос сразу
      fetchDataFromDB();
      
      // Затем запускаем интервал
      const interval = setInterval(() => {
        fetchDataFromDB();
      }, updateConfig.interval);
      
      setPollingIntervalId(interval);
      
      return () => {
        if (interval) {
          clearInterval(interval);
        }
      };
    } else if (pollingIntervalId) {
      clearInterval(pollingIntervalId);
      setPollingIntervalId(null);
    }

  }, [updateConfig.isAutoUpdate, updateConfig.interval, dataSourceInfo, fetchDataFromDB]);

  // Закрытие панели настроек при клике вне её
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        settingsPanelRef.current && 
        !settingsPanelRef.current.contains(event.target) &&
        !event.target.closest('.settings-toggle-btn') &&
        !event.target.closest('.update-toggle-btn')
      ) {
        setUpdateConfig(prev => ({
          ...prev,
          isSettingsOpen: false
        }));
      }
    };
    
    if (updateConfig.isSettingsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [updateConfig.isSettingsOpen]);


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

  // Открыть/закрыть настройки обновления
  const toggleSettings = useCallback(() => {
    setUpdateConfig(prev => ({
      ...prev,
      isSettingsOpen: !prev.isSettingsOpen
    }));
  }, []);


  // Кастомный ресайзер с квадратными ручками
  const CustomResizer = () => {
    if (!selected) return null;

    return (
      <>
        {/* Верхний левый угол */}
        <div
          className="resize-handle-square top-left"
          onMouseDown={(e) => startResize(e, 'top-left')}
          title="Изменить размер"
        />
        
        {/* Верхний правый угол */}
        <div
          className="resize-handle-square top-right"
          onMouseDown={(e) => startResize(e, 'top-right')}
          title="Изменить размер"
        />
        
        {/* Нижний левый угол */}
        <div
          className="resize-handle-square bottom-left"
          onMouseDown={(e) => startResize(e, 'bottom-left')}
          title="Изменить размер"
        />
        
        {/* Нижний правый угол */}
        <div
          className="resize-handle-square bottom-right"
          onMouseDown={(e) => startResize(e, 'bottom-right')}
          title="Изменить размер"
        />
        
        {/* Верхняя сторона */}
        <div
          className="resize-handle-square top"
          onMouseDown={(e) => startResize(e, 'top')}
          title="Изменить высоту"
        />
        
        {/* Правая сторона */}
        <div
          className="resize-handle-square right"
          onMouseDown={(e) => startResize(e, 'right')}
          title="Изменить ширину"
        />
        
        {/* Нижняя сторона */}
        <div
          className="resize-handle-square bottom"
          onMouseDown={(e) => startResize(e, 'bottom')}
          title="Изменить высоту"
        />
        
        {/* Левая сторона */}
        <div
          className="resize-handle-square left"
          onMouseDown={(e) => startResize(e, 'left')}
          title="Изменить ширину"
        />
      </>
    );
  };

  const startResize = (e, direction) => {
    e.preventDefault();
    e.stopPropagation();
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = nodeSize.width;
    const startHeight = nodeSize.height;
    
    setIsResizing(true);
    document.body.style.cursor = getCursor(direction);
    
    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      
      let newWidth = startWidth;
      let newHeight = startHeight;
      
      // В зависимости от направления изменяем размеры
      switch (direction) {
        case 'right':
          newWidth = Math.max(300, startWidth + deltaX);
          break;
        case 'left':
          newWidth = Math.max(300, startWidth - deltaX);
          break;
        case 'bottom':
          newHeight = Math.max(200, startHeight + deltaY);
          break;
        case 'top':
          newHeight = Math.max(200, startHeight - deltaY);
          break;
        case 'top-left':
          newWidth = Math.max(300, startWidth - deltaX);
          newHeight = Math.max(200, startHeight - deltaY);
          break;
        case 'top-right':
          newWidth = Math.max(300, startWidth + deltaX);
          newHeight = Math.max(200, startHeight - deltaY);
          break;
        case 'bottom-left':
          newWidth = Math.max(300, startWidth - deltaX);
          newHeight = Math.max(200, startHeight + deltaY);
          break;
        case 'bottom-right':
          newWidth = Math.max(300, startWidth + deltaX);
          newHeight = Math.max(200, startHeight + deltaY);
          break;
      }
      
      // Ограничиваем максимальные размеры
      newWidth = Math.min(999999, newWidth);
      newHeight = Math.min(99999, newHeight);
      
      setNodeSize({ width: newWidth, height: newHeight });
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      
      // Обновляем данные узла
      if (data.onResize) {
        data.onResize(id, nodeSize.width, nodeSize.height);
      }
      
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  
  const getCursor = (direction) => {
    switch (direction) {
      case 'top-left':
      case 'bottom-right':
        return 'nwse-resize';
      case 'top-right':
      case 'bottom-left':
        return 'nesw-resize';
      case 'top':
      case 'bottom':
        return 'ns-resize';
      case 'left':
      case 'right':
        return 'ew-resize';
      default:
        return 'default';
    }
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
        minWidth: 300,
        minHeight: 200,
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
          <span>{data.label || 'График'}</span>
          {dataSourceInfo && (
            <span className="data-source-badge ms-2">
              <i className="bi bi-database me-1"></i>
              {dataSourceInfo.table}: {dataSourceInfo.xAxis} → {dataSourceInfo.yAxis}
            </span>
          )}
          <span className="data-count-badge ms-1">
            {chartData.length} точек
            {updateConfig.isAutoUpdate && (
              <span className="ms-1" style={{ color: '#28a745' }}>
                <i className="bi bi-arrow-clockwise me-1"></i>
                авто
              </span>
            )}
          </span>
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
            disabled={!dataSourceInfo}
            title={dataSourceInfo ? 
              (updateConfig.isAutoUpdate ? "Остановить автообновление" : "Включить автообновление из БД") : 
              "Сначала выберите источник данных"}
          >
            <i className={`bi ${updateConfig.isAutoUpdate ? 'bi-pause-circle' : 'bi-play-circle'}`}></i>
          </button>
          
          {/* Кнопка настройки */}
          <button
            className={`btn btn-sm settings-toggle-btn ${updateConfig.isSettingsOpen ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={toggleSettings}
            title="Настройки обновления"
          >
            <i className={`bi ${updateConfig.isSettingsOpen ? 'bi-chevron-up' : 'bi-gear'}`}></i>
          </button>
        </div>
      </div>
      
      {/* Выдвижная панель настроек обновления */}
      {updateConfig.isSettingsOpen && (
        <div ref={settingsPanelRef} className="update-settings-panel">
          <div className="settings-header">
            <small>Настройки обновления из БД</small>
            <button 
              className="btn-close btn-close-white btn-sm"
              onClick={toggleSettings}
              style={{ fontSize: '10px' }}
            />
          </div>
          
          <div className="settings-body">
            <div className="mb-3">
              <label className="form-label" style={{ fontSize: '12px', marginBottom: '8px' }}>
                Интервал опроса БД (100-10000 мс)
              </label>
              <div className="input-group input-group-sm">
                <input
                  type="number"
                  className="form-control form-control-sm"
                  value={intervalInput}
                  // onChange={handleIntervalInputChange}
                  // onBlur={handleIntervalInputBlur}
                  min="100"
                  max="10000"
                  step="100"
                  style={{
                    textAlign: 'center',
                    backgroundColor: '#333',
                    borderColor: '#555',
                    color: '#fff',
                    fontSize: '13px'
                  }}
                />
                <span className="input-group-text" style={{ backgroundColor: '#333', borderColor: '#555', color: '#ccc' }}>
                  мс
                </span>
              </div>
              <div className="form-text text-muted mt-1" style={{ fontSize: '10px' }}>
                Частота опроса базы данных для новых записей
              </div>
            </div>
            
            {dataSourceInfo && (
              <div className="mb-3">
                <div className="alert alert-info py-1 px-2" style={{ fontSize: '11px' }}>
                  
                </div>
              </div>
            )}
            
            <button
              className="btn btn-sm btn-outline-info w-100"
              onClick={fetchDataFromDB}
              disabled={isUpdating || !dataSourceInfo}
            >
              {isUpdating ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                  Загрузка...
                </>
              ) : (
                <>
                  <i className="bi bi-arrow-clockwise me-1"></i>
                  Загрузить сейчас
                </>
              )}
            </button>
          </div>
        </div>
      )}
      

      <div className="chart-node-content">
        {Chart && (
          <Chart 
            activeGraphUpdate={activeGraphUpdate}
            chartData={chartData} //данные 
            width={nodeSize.width}
            height={nodeSize.height - 60}
          />
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

  // Функция для генерации случайных данных
  const generateRandomData = useCallback((count = 100) => {
    const newData = [];
    const now = new Date();
    const baseTime = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    
    for (let i = 0; i < count; i++) {
      const timeOffset = i * 0.1;
      const value = Math.random() * 100 + 50 + Math.sin(i * 0.1) * 20;
      const overload = Math.random() > 0.95;
      
      const timeInSeconds = baseTime + timeOffset;
      const hours = Math.floor(timeInSeconds / 3600) % 24;
      const minutes = Math.floor((timeInSeconds % 3600) / 60);
      const seconds = (timeInSeconds % 60).toFixed(3);
      
      newData.push({
        time: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds}`,
        value: value.toFixed(3),
        overload: overload
      });
    }
    
    return newData;
  }, []);

  // Обработчик подключения
  const handleConnect = useCallback(() => {
    setIsConnected(true); 
    
    if (data.type === 'source') {
      if (data.onDataGenerate) {
        const initialData = generateRandomData(dataCount);
        data.onDataGenerate(initialData);
      }
      
      const id = setInterval(() => {
        if (data.onDataGenerate) {
          const newData = generateRandomData(10);
          data.onDataGenerate(newData);
        }
      }, 1000);
      
      setIntervalId(id);
    }
  }, [data, dataCount, generateRandomData]);

  // Обработчик отключения
  const handleDisconnect = useCallback(() => {
    setIsConnected(false);
    
    if (intervalId) {
      clearInterval(intervalId);
      setIntervalId(null);
    }
  }, [intervalId]);

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
const ProcessorNode = ({ data, isConnectable, selected, id }) => {
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

// Зарегистрируем типы узлов
const nodeTypes = {
  chartNode: ChartNode,
  dataSourceNode: DataSourceNode,
  processorNode: ProcessorNode
};

// Основной компонент графа
const Graph = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [rfInstance, setRfInstance] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [nodeCounter, setNodeCounter] = useState(1);
  const { updateNode } = useReactFlow();

  // Глобальная функция для обновления данных узла
  useEffect(() => {
    // Экспортируем функцию для доступа из Sidebar
    window.updateNodeData = (nodeId, data) => {
      setNodes((nds) => 
        nds.map((node) => {
          if (node.id === nodeId && node.type === 'chartNode') {
            return {
              ...node,
              data: {
                ...node.data,
                initialData: data,
                dataSourceInfo: data.sourceInfo
              }
            };
          }
          return node;
        })
      );
      console.log(`Данные обновлены для узла ${nodeId}:`, data.length, 'точек');
      //console.log(data)
    };
    
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

  // Добавление нового источника данных
  const addDataSourceNode = useCallback(() => {
    const newNodeId = `${nodeCounter}`;
    const newNode = {
      id: newNodeId,
      type: 'dataSourceNode',
      position: { 
        x: Math.random() * 200 + 50, 
        y: Math.random() * 300 + 50 
      },
      data: {
        label: `Источник ${nodeCounter}`,
        description: 'Генерирует данные',
        type: 'source',
        icon: 'bi-database',
        dataType: 'Случайные данные',
        width: 300,
        height: 200,
        onDataGenerate: (data) => {
          // Найти связанные узлы графика и обновить их данные
          const connectedNodes = edges
            .filter(edge => edge.source === newNodeId)
            .map(edge => nodes.find(node => node.id === edge.target));
          
          connectedNodes.forEach(node => {
            if (node.type === 'chartNode') {
              setNodes((nds) => 
                nds.map((n) => {
                  if (n.id === node.id) {
                    return {
                      ...n,
                      data: {
                        ...n.data,
                        initialData: [...(n.data.initialData || []), ...data]
                      }
                    };
                  }
                  return n;
                })
              );
            }
          });
        }
      },
      style: { 
        width: 300, 
        height: 200 
      }
    };
    
    setNodes((nds) => [...nds, newNode]);
    setNodeCounter((prev) => prev + 1);
  }, [nodeCounter, setNodes, edges, nodes]);

  // Добавление нового обработчика
  const addProcessorNode = useCallback(() => {
    const newNodeId = `${nodeCounter}`;
    const newNode = {
      id: newNodeId,
      type: 'processorNode',
      position: { 
        x: Math.random() * 300 + 150, 
        y: Math.random() * 300 + 50 
      },
      data: {
        label: `Обработчик ${nodeCounter}`,
        description: 'Обрабатывает данные',
        icon: 'bi-gear',
        width: 300,
        height: 200,
        parameters: {
          тип: 'стандартный',
          режим: 'авто'
        }
      },
      style: { 
        width: 300, 
        height: 200 
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
        onAddDataSourceNode={addDataSourceNode}
        onAddProcessorNode={addProcessorNode}
        onDeleteSelectedNode={deleteSelectedNode}
        onResetGraph={resetGraph}
        selectedNode={selectedNode}
        graphInfo={graphInfo}
      />
      
      {/* React Flow */}
      <div className="reactflow-wrapper">
        <ReactFlow
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
          nodesResizable={true}
          onPaneContextMenu={(e) => e.preventDefault()}
          onNodeContextMenu={(e, node) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <Controls />
          <Background variant="dots" gap={12} size={1} />
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