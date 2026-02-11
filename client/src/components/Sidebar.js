import React, { useState, useRef, useEffect, useCallback } from 'react';
import './Sidebar.css';

const API_BASE_URL = 'http://localhost:8080/api';

const Sidebar = ({ 
  width = 300, 
  minWidth = 20,
  maxWidth = 600,
  onAddChartNode,
  onAddDataSourceNode,
  onAddProcessorNode,
  onDeleteSelectedNode,
  onResetGraph,
  selectedNode,
  graphInfo
}) => {
  const [sidebarWidth, setSidebarWidth] = useState(width);
  const [isResizing, setIsResizing] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const sidebarRef = useRef(null);
  const resizeTimeoutRef = useRef(null);
  const lastUpdateTimeRef = useRef(Date.now());
  const collapseThreshold = 80;

  const [generationState, setGenerationState] = useState({
    isGenerating: false,
    isLoading: false,
    interval: 50,
    chartId: 'default-chart'
  });

  // Новое состояние для параметров графика
  const [chartParams, setChartParams] = useState({
    tables: [],
    selectedTable: '',
    tableData: [],
    columns: [],
    xAxisColumn: '',
    yAxisColumn: '',
    isLoadingParams: false,
    paramError: ''
  });

  // Загрузка таблиц при монтировании компонента
  useEffect(() => {
    if (selectedNode && selectedNode.type === 'dataSourceNode') {
      loadTables();
    }
  }, [selectedNode]);

  // Функция загрузки таблиц из БД
  const loadTables = useCallback(async () => {
    try {
      setChartParams(prev => ({ ...prev, isLoadingParams: true, paramError: '' }));
      
      const response = await fetch(`${API_BASE_URL}/metadata`);
      if (!response.ok) throw new Error('Ошибка загрузки метаданных');
      
      const data = await response.json();
      const metadata = data.metadata || data;
      
      if (metadata.tables) {
        const tableNames = metadata.tables.map(table => table.table_name);
        setChartParams(prev => ({
          ...prev,
          tables: tableNames,
          isLoadingParams: false
        }));
      }
    } catch (err) {
      setChartParams(prev => ({
        ...prev,
        paramError: `Ошибка загрузки таблиц: ${err.message}`,
        isLoadingParams: false
      }));
    }
  }, []);

    // Функция загрузки данных выбранной таблицы
  const loadTableData = useCallback(async (tableName) => {
    if (!tableName) return;
    
    try {
      setChartParams(prev => ({ ...prev, isLoadingParams: true, paramError: '' }));
      
      const sql = `SELECT * FROM ${tableName} ORDER BY 1 ASC`; // Сортируем по первому столбцу
      
      const response = await fetch(`${API_BASE_URL}/execute-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql })
      });

      if (!response.ok) throw new Error('Ошибка загрузки данных');
      
      const result = await response.json();
      const data = result.data || result;
      
      if (data.length > 0) {
        const columns = Object.keys(data[0]);
        setChartParams(prev => ({
          ...prev,
          selectedTable: tableName,
          tableData: data,
          columns: columns,
          xAxisColumn: columns.find(col => 
            col.toLowerCase().includes('time') || 
            col.toLowerCase().includes('date') ||
            col.toLowerCase().includes('timestamp')
          ) || columns[0] || '',
          yAxisColumn: columns.find(col => 
            col.toLowerCase().includes('value') || 
            col.toLowerCase().includes('current') ||
            col.toLowerCase().includes('voltage') ||
            col.toLowerCase().includes('measurement')
          ) || columns[1] || '',
          isLoadingParams: false
        }));
      } else {
        // Если данных нет, получаем колонки из метаданных
        const metaResponse = await fetch(`${API_BASE_URL}/metadata`);
        const metadata = await metaResponse.json();
        
        const table = metadata.metadata?.tables?.find(t => t.table_name === tableName);
        if (table) {
          const columns = table.columns.map(col => col.column_name);
          setChartParams(prev => ({
            ...prev,
            selectedTable: tableName,
            tableData: [],
            columns: columns,
            xAxisColumn: columns[0] || '',
            yAxisColumn: columns[1] || '',
            isLoadingParams: false
          }));
        }
      }
      
    } catch (err) {
      setChartParams(prev => ({
        ...prev,
        paramError: `Ошибка загрузки данных: ${err.message}`,
        isLoadingParams: false
      }));
    }
  }, []);

// Функция для применения параметров графика к узлу
  const applyChartParams = useCallback(() => {
    if (!selectedNode || !chartParams.selectedTable) return;
    
    const { xAxisColumn, yAxisColumn, tableData } = chartParams;
    
    if (!xAxisColumn || !yAxisColumn) {
      setChartParams(prev => ({
        ...prev,
        paramError: 'Выберите столбцы для осей X и Y'
      }));
      return;
    }
    
    // Форматируем данные для графика
    const formattedData = tableData
      .filter(row => row[xAxisColumn] != null && row[yAxisColumn] != null)
      .map((row, index) => {
        // Пытаемся преобразовать значения в числа для оси Y
        const yValue = parseFloat(row[yAxisColumn]);
        
        // Для оси X: если это дата/время, преобразуем в секунды
        let timeValue;
        const xValue = row[xAxisColumn];
        
        if (xValue instanceof Date) {
          timeValue = xValue.getTime() / 1000;
        } else if (typeof xValue === 'string') {
          // Пытаемся разобрать строку времени HH:MM:SS.mmm
          const timeMatch = xValue.match(/(\d{1,2}):(\d{1,2}):(\d{1,2})(?:\.(\d+))?/);
          if (timeMatch) {
            const hours = parseInt(timeMatch[1]) || 0;
            const minutes = parseInt(timeMatch[2]) || 0;
            const seconds = parseInt(timeMatch[3]) || 0;
            const milliseconds = timeMatch[4] ? parseInt(timeMatch[4].substring(0, 3)) : 0;
            timeValue = hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
          } else {
            // Пытаемся преобразовать в число
            timeValue = parseFloat(xValue) || 0;
          }
        } else if (typeof xValue === 'number') {
          timeValue = xValue;
        } else {
          // Используем индекс как время
          timeValue = index;
        }
        
        return {
          time: timeValue,
          value: isNaN(yValue) ? 0 : yValue,
          originalTime: xValue,
          originalValue: row[yAxisColumn],
          seriesId: 'database',
          timestamp: Date.now()
        };
      });
    
    // Сортируем по времени
    formattedData.sort((a, b) => a.time - b.time);
    
    // Создаем информацию об источнике данных
    const sourceInfo = {
      table: chartParams.selectedTable,
      xAxis: xAxisColumn,
      yAxis: yAxisColumn,
      dataPoints: formattedData.length
    };
    
    // Используем глобальную функцию для обновления узла
    if (window.updateNodeData && selectedNode) {
      window.updateNodeData(selectedNode.id, formattedData);
      
      // Также сохраняем информацию об источнике
      setTimeout(() => {
        window.updateNodeData(selectedNode.id, {
          ...formattedData,
          sourceInfo // Добавляем метаданные
        });
      }, 100);
    }
    
    // Сохраняем в localStorage для сохранности
    localStorage.setItem(`chartData_${selectedNode.id}`, JSON.stringify({
      data: formattedData,
      params: sourceInfo
    }));
    
    setChartParams(prev => ({
      ...prev,
      paramError: '',
      isLoadingParams: false
    }));
    
    // Показываем уведомление
    console.log(`Данные загружены: ${formattedData.length} точек`, sourceInfo);
    
  }, [selectedNode, chartParams]);

  // Функция запуска генерации
  const startGeneration = async () => {
    setGenerationState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const response = await fetch(`${API_BASE_URL}/generation/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interval: generationState.interval,
          chartId: generationState.chartId
        })
      });

      if (response.ok) {
        setGenerationState(prev => ({ 
          ...prev, 
          isGenerating: true,
          isLoading: false 
        }));
      }
    } catch (error) {
      console.error('Ошибка:', error);
    } finally {
      setGenerationState(prev => ({ ...prev, isLoading: false }));
    }
  };

  // Функция остановки генерации
  const stopGeneration = async () => {
    setGenerationState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const response = await fetch(`${API_BASE_URL}/generation/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        setGenerationState(prev => ({ 
          ...prev, 
          isGenerating: false,
          isLoading: false 
        }));
      }
    } catch (error) {
      console.error('Ошибка:', error);
    } finally {
      setGenerationState(prev => ({ ...prev, isLoading: false }));
    }
  };

  // Проверка статуса при загрузке
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/generation/status`);
        if (response.ok) {
          const data = await response.json();
          setGenerationState(prev => ({ 
            ...prev, 
            isGenerating: data.isGenerating 
          }));
        }
      } catch (error) {
        console.error('Ошибка проверки статуса:', error);
      }
    };
    
    checkStatus();
  }, []);

  // Функция для безопасного изменения ширины с задержкой
  const safeSetWidth = useCallback((newWidth) => {
    if (resizeTimeoutRef.current) {
      cancelAnimationFrame(resizeTimeoutRef.current);
    }
    
    resizeTimeoutRef.current = requestAnimationFrame(() => {
      setSidebarWidth(Math.max(minWidth, Math.min(maxWidth, newWidth)));
      
      setTimeout(() => {
        if (newWidth <= collapseThreshold && !isCollapsed) {
          setIsCollapsed(true);
        } else if (newWidth > collapseThreshold && isCollapsed) {
          setIsCollapsed(false);
        }
      }, 50);
    });
  }, [isCollapsed, collapseThreshold, minWidth, maxWidth]);

  // Поэтапное сворачивание с анимацией
  const toggleSidebar = useCallback(() => {
    if (isAnimating || isResizing) return;
    
    setIsAnimating(true);
    
    if (isCollapsed) {
      const targetWidth = width;
      const steps = [minWidth + 50, minWidth + 150, targetWidth];
      
      steps.forEach((stepWidth, index) => {
        setTimeout(() => {
          safeSetWidth(stepWidth);
          if (index === steps.length - 1) {
            setIsCollapsed(false);
            setIsAnimating(false);
          }
        }, index * 100);
      });
    } else {
      const steps = [width * 0.7, width * 0.4, minWidth];
      
      steps.forEach((stepWidth, index) => {
        setTimeout(() => {
          safeSetWidth(stepWidth);
          if (index === steps.length - 1) {
            setIsCollapsed(true);
            setIsAnimating(false);
          }
        }, index * 80);
      });
    }
  }, [isCollapsed, isAnimating, width, minWidth, safeSetWidth, isResizing]);

  // Обработчик клика на весь сайдбар в свернутом состоянии
  const handleSidebarClick = useCallback((e) => {
    if (isCollapsed && !e.target.closest('.sidebar-resizer')) {
      toggleSidebar();
    }
  }, [isCollapsed, toggleSidebar]);

  // Оптимизированный обработчик ресайза
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsResizing(true);
    lastUpdateTimeRef.current = Date.now();
    
    const startX = e.clientX;
    const startWidth = isCollapsed ? minWidth : sidebarWidth;
    
    const effectiveStartWidth = isCollapsed ? minWidth : sidebarWidth;
    
    if (sidebarRef.current) {
      sidebarRef.current.classList.add('resizing-active');
    }
    
    const handleMouseMove = (e) => {
      const currentTime = Date.now();
      const timeDiff = currentTime - lastUpdateTimeRef.current;
      
      if (timeDiff < 16) return;
      
      lastUpdateTimeRef.current = currentTime;
      
      const diff = e.clientX - startX;
      let newWidth = Math.max(minWidth, Math.min(maxWidth, effectiveStartWidth + diff));
      
      if (newWidth > minWidth + 10 && isCollapsed) {
        setIsCollapsed(false);
      }
      
      requestAnimationFrame(() => {
        if (sidebarRef.current) {
          sidebarRef.current.style.width = `${newWidth}px`;
          sidebarRef.current.style.setProperty('--sidebar-width', `${newWidth}px`);
          setSidebarWidth(newWidth);
        }
      });
    };
    
    const handleMouseUp = () => {
      const finalWidth = parseInt(sidebarRef.current?.style.width || sidebarWidth);
      
      if (finalWidth > collapseThreshold && isCollapsed) {
        setIsCollapsed(false);
      }
      
      setTimeout(() => {
        if (sidebarRef.current) {
          sidebarRef.current.classList.remove('resizing-active');
        }
      }, 100);
      
      safeSetWidth(finalWidth);
      setIsResizing(false);
      setIsAnimating(false);
      
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove, { passive: false });
    document.addEventListener('mouseup', handleMouseUp, { once: true });
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [sidebarWidth, minWidth, maxWidth, isCollapsed, collapseThreshold, safeSetWidth]);

  // Эффект для применения ширины
  useEffect(() => {
    if (!sidebarRef.current) return;
    
    const sidebar = sidebarRef.current;
    
    if (isResizing || isAnimating) {
      sidebar.style.transition = 'none';
      sidebar.style.willChange = 'width';
    } else {
      setTimeout(() => {
        if (sidebar) {
          sidebar.style.transition = 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
          sidebar.style.willChange = 'auto';
        }
      }, 50);
    }
    
    sidebar.style.width = `${sidebarWidth}px`;
  }, [sidebarWidth, isResizing, isAnimating]);

  // Очистка
  useEffect(() => {
    return () => {
      if (resizeTimeoutRef.current) {
        cancelAnimationFrame(resizeTimeoutRef.current);
      }
      document.documentElement.classList.remove('no-transitions');
    };
  }, []);

  return (
    <>
      <div 
        ref={sidebarRef}
        className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isResizing ? 'resizing' : ''} ${isAnimating ? 'animating' : ''}`}
        style={{
          '--sidebar-width': `${sidebarWidth}px`
        }}
        onClick={isCollapsed ? handleSidebarClick : undefined}
      >
        {/* Иконка в свернутом состоянии */}
        {isCollapsed && !isResizing && (
          <div 
            className="sidebar-collapsed-icon"
            onClick={toggleSidebar}
            title="Развернуть панель"
            style={{ cursor: 'pointer' }}
          >
            <i className="bi bi-chevron-right"></i>
          </div>
        )}

        {!isCollapsed && (
          <>
            <div className="sidebar-header">
              <h5 className="sidebar-title">
                <i className="bi bi-diagram-3"></i>
                Панель управления
              </h5>
              
              <button 
                className="btn btn-sm btn-outline-secondary sidebar-toggle-btn"
                onClick={toggleSidebar}
                disabled={isAnimating || isResizing}
                title="Свернуть панель"
              >
                <i className="bi bi-chevron-left"></i>
              </button>
            </div>

            <div className="sidebar-content">
              {/* Добавление узлов */}
              <div className="sidebar-section">
                <h6 className="sidebar-section-title">
                  <i className="bi bi-plus-circle"></i>
                  Добавить компонент
                </h6>
                <div className="add-node-buttons">
                  <button 
                    className="btn btn-outline-primary btn-sm w-100 mb-2"
                    onClick={onAddChartNode}
                  >
                    <i className="bi bi-bar-chart"></i> График
                  </button>
                  <button 
                    className="btn btn-outline-success btn-sm w-100 mb-2"
                    onClick={onAddDataSourceNode}
                  >
                    <i className="bi bi-database"></i> Векторная диаграмма(None)
                  </button>
                  <button 
                    className="btn btn-outline-warning btn-sm w-100"
                    onClick={onAddProcessorNode}
                  >
                    <i className="bi bi-gear"></i> Доп. инструмент
                  </button>
                </div>
              </div>

              {/* Управление */}
              <div className="sidebar-section">
                <h6 className="sidebar-section-title">
                  <i className="bi bi-sliders"></i>
                  Управление
                </h6>
                <div className="management-buttons">
                  <button 
                    className="btn btn-danger btn-sm w-100 mb-2"
                    onClick={onDeleteSelectedNode}
                    disabled={!selectedNode}
                    title={!selectedNode ? "Выберите узел для удаления" : "Удалить выбранный узел"}
                  >
                    <i className="bi bi-trash"></i> Удалить узел
                  </button>
                  <div className="btn-group w-100" role="group">
                    <button 
                      className="btn btn-warning btn-sm"
                      onClick={onResetGraph}
                    >
                      <i className="bi bi-arrow-clockwise"></i> Сброс
                    </button>
                  </div>
                  <div className="btn-group w-100 mt-2" role="group">
                    <button 
                      className={`btn btn-sm mb-2 ${generationState.isGenerating ? 'btn-danger' : 'btn-primary'}`}
                      onClick={generationState.isGenerating ? stopGeneration : startGeneration}
                      disabled={generationState.isLoading}
                    >
                      {generationState.isLoading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                          {generationState.isGenerating ? 'Остановка...' : 'Запуск...'}
                        </>
                      ) : (
                        <>
                          <i className={`bi ${generationState.isGenerating ? 'bi-stop-circle' : 'bi-play-circle'} me-1`}></i>
                          {generationState.isGenerating ? 'Остановить генерацию' : 'Начать генерацию данных'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Выбранный узел */}
              {selectedNode && (
                <div className="sidebar-section">
                  <h6 className="sidebar-section-title">
                    <i className="bi bi-node-plus"></i>
                    Параметры графика
                  </h6>
                  <div className="selected-node-info">
                    <div className="selected-node-header">
                      <span className="badge bg-primary">
                        {selectedNode.type === 'dataSourceNode' && 'Источник'}
                        {selectedNode.type === 'processorNode' && 'Обработчик'}
                      </span>
                      <span className="ms-2">{selectedNode.data.label}</span>
                    </div>
                    <div className="selected-node-details">
                      {/* Блок выбора параметров графика из БД */}
                      <div className="chart-params-selector mt-3">
                        <h6 className="mb-2" style={{ fontSize: '14px', fontWeight: 'bold' }}>
                          <i className="bi bi-database me-1"></i> Выбор данных из БД
                        </h6>
                        
                        {chartParams.paramError && (
                          <div className="alert alert-danger alert-dismissible fade show py-1 px-2 mb-2" style={{ fontSize: '12px' }}>
                            <i className="bi bi-exclamation-triangle me-1"></i>
                            {chartParams.paramError}
                            <button 
                              type="button" 
                              className="btn-close btn-close-sm" 
                              onClick={() => setChartParams(prev => ({ ...prev, paramError: '' }))}
                            ></button>
                          </div>
                        )}
                        
                        {/* Выбор таблицы */}
                        <div className="mb-2">
                          <label className="form-label" style={{ fontSize: '12px' }}>Таблица:</label>
                          <div className="input-group input-group-sm">
                            <select 
                              className="form-select form-select-sm"
                              value={chartParams.selectedTable}
                              onChange={(e) => loadTableData(e.target.value)}
                              disabled={chartParams.isLoadingParams}
                            >
                              <option value="">Выберите таблицу...</option>
                              {chartParams.tables.map(table => (
                                <option key={table} value={table}>{table}</option>
                              ))}
                            </select>
                            <button 
                              className="btn btn-outline-secondary btn-sm"
                              onClick={loadTables}
                              disabled={chartParams.isLoadingParams}
                              title="Обновить список таблиц"
                            >
                              <i className="bi bi-arrow-clockwise"></i>
                            </button>
                          </div>
                        </div>
                        
                        {/* Выбор столбцов для осей */}
                        {chartParams.columns.length > 0 && (
                          <>
                            <div className="mb-2">
                              <label className="form-label" style={{ fontSize: '12px' }}>Ось X (Время):</label>
                              <select 
                                className="form-select form-select-sm"
                                value={chartParams.xAxisColumn}
                                onChange={(e) => setChartParams(prev => ({ ...prev, xAxisColumn: e.target.value }))}
                                disabled={chartParams.isLoadingParams}
                              >
                                <option value="">Выберите столбец...</option>
                                {chartParams.columns.map(column => (
                                  <option key={`x-${column}`} value={column}>{column}</option>
                                ))}
                              </select>
                            </div>
                            
                            <div className="mb-3">
                              <label className="form-label" style={{ fontSize: '12px' }}>Ось Y (Значение):</label>
                              <select 
                                className="form-select form-select-sm"
                                value={chartParams.yAxisColumn}
                                onChange={(e) => setChartParams(prev => ({ ...prev, yAxisColumn: e.target.value }))}
                                disabled={chartParams.isLoadingParams}
                              >
                                <option value="">Выберите столбец...</option>
                                {chartParams.columns.map(column => (
                                  <option key={`y-${column}`} value={column}>{column}</option>
                                ))}
                              </select>
                            </div>
                            
                            {/* Статистика данных */}
                            {chartParams.tableData.length > 0 && (
                              <div className="data-stats mb-3 p-2 bg-dark rounded" style={{ fontSize: '11px' }}>
                                <div className="d-flex justify-content-between">
                                  <span>Записей:</span>
                                  <span className="badge bg-info">{chartParams.tableData.length}</span>
                                </div>
                                <div className="d-flex justify-content-between">
                                  <span>Столбцов:</span>
                                  <span className="badge bg-info">{chartParams.columns.length}</span>
                                </div>
                              </div>
                            )}
                            
                            {/* Кнопки действий */}
                            <div className="d-grid gap-2">
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={applyChartParams}
                                disabled={chartParams.isLoadingParams || !chartParams.xAxisColumn || !chartParams.yAxisColumn}
                              >
                                {chartParams.isLoadingParams ? (
                                  <>
                                    <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                                    Загрузка...
                                  </>
                                ) : (
                                  <>
                                    <i className="bi bi-check-circle me-1"></i>
                                    Применить параметры
                                  </>
                                )}
                              </button>
                              
                              {chartParams.selectedTable && (
                                <button
                                  className="btn btn-outline-secondary btn-sm"
                                  onClick={() => loadTableData(chartParams.selectedTable)}
                                  disabled={chartParams.isLoadingParams}
                                >
                                  <i className="bi bi-arrow-clockwise me-1"></i>
                                  Обновить данные
                                </button>
                              )}
                            </div>
                          </>
                        )}
                        
                        {/* Индикатор загрузки */}
                        {chartParams.isLoadingParams && (
                          <div className="text-center py-2">
                            <div className="spinner-border spinner-border-sm text-primary" role="status">
                              <span className="visually-hidden">Загрузка...</span>
                            </div>
                            <small className="text-muted d-block mt-1">Загрузка данных...</small>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Быстрые действия */}
              {/* ... существующий код ... */}
            </div>
          </>
        )}

        {/* Ресайзер с улучшенной визуализацией */}
        <div 
          className={`sidebar-resizer ${isResizing ? 'active' : ''}`}
          onMouseDown={handleMouseDown}
          title={isCollapsed ? "Потяните чтобы развернуть" : "Изменить ширину панели"}
        >
          <div className="resizer-handle" />
        </div>
      </div>
    </>
  );
};

export default Sidebar;