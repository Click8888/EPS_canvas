import React, { useState, useRef, useEffect, useCallback } from 'react';
import './Sidebar.css';

const API_BASE_URL = 'http://localhost:8080/api';

const Sidebar = ({ 
  width = 300, 
  minWidth = 20,
  maxWidth = 600,
  onAddChartNode,
  onAddRadialChartNode,
  onDeleteSelectedNode,
  onResetGraph,
  selectedNode
}) => {
  const [sidebarWidth, setSidebarWidth] = useState(width);
  const [isResizing, setIsResizing] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const sidebarRef = useRef(null);
  const resizeTimeoutRef = useRef(null);
  const lastUpdateTimeRef = useRef(Date.now());
  const collapseThreshold = 80;

  const [chartLines, setChartLines] = useState({}); // { chartId: [lines] }
  const [nextLineIds, setNextLineIds] = useState({}); // { chartId: nextId }
  const [currentLines, setCurrentLines] = useState([]); // Линии текущего выбранного графика
  const [tableColumnsCache, setTableColumnsCache] = useState({});

  // Палитра цветов для линий
  const COLOR_PALETTE = [
    '#133592', '#e74c3c', '#2ecc71', '#f39c12', 
    '#9b59b6', '#1abc9c', '#e67e22', '#3498db',
    '#16a085', '#c0392b', '#8e44ad', '#d35400'
  ];

  // Функция для генерации случайного цвета из палитры
  const getRandomColor = () => {
    return COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];
  };

  // Состояние для параметров графика
  const [chartParams, setChartParams] = useState({
    tables: [],
    isLoadingParams: false,
    paramError: ''
  });

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
      } else {
        setChartParams(prev => ({
          ...prev,
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

  // Загрузка линий при выборе графика
  useEffect(() => {
    if (selectedNode && (selectedNode.type === 'chartNode' || selectedNode.type === 'radialChartNode')) {
      const chartId = selectedNode.id;
      
      // Если у графика еще нет линий, создаем одну линию по умолчанию
      if (!chartLines[chartId]) {
        const defaultLine = {
          id: `line-1`,
          name: `Линия 1`,
          table: '',
          xAxis: '',
          yAxis: '',
          angleAxis: '', // для радиального графика
          magnitudeAxis: '', // для радиального графика
          color: getRandomColor(),
          data: [] // данные будут приходить из GlobalDataStream
        };
        
        setChartLines(prev => ({
          ...prev,
          [chartId]: [defaultLine]
        }));
        
        setNextLineIds(prev => ({
          ...prev,
          [chartId]: 2
        }));
        
        setCurrentLines([defaultLine]);
      } else {
        // Загружаем существующие линии этого графика
        setCurrentLines(chartLines[chartId]);
      }
    } else {
      setCurrentLines([]);
    }
  }, [selectedNode, chartLines]);

  // Загрузка таблиц при монтировании компонента и при смене БД
  useEffect(() => {
    loadTables();
    
    const handleDbConnectionChange = (event) => {
      console.log('Обнаружена смена БД, перезагружаем таблицы...', event.detail);
      setTableColumnsCache({});
      loadTables();
    };
    
    window.addEventListener('db-connection-changed', handleDbConnectionChange);
    
    return () => {
      window.removeEventListener('db-connection-changed', handleDbConnectionChange);
    };
  }, [loadTables]);

  // Добавить линию
  const addLine = () => {
    if (!selectedNode || (selectedNode.type !== 'chartNode' && selectedNode.type !== 'radialChartNode')) return;
    
    const chartId = selectedNode.id;
    const currentNextId = nextLineIds[chartId] || 1;
    
    const newLine = {
      id: `line-${currentNextId}`,
      name: `Линия ${currentNextId}`,
      table: '',
      xAxis: '',
      yAxis: '',
      angleAxis: '',
      magnitudeAxis: '',
      color: getRandomColor(),
      data: []
    };
    
    const updatedLines = [...(chartLines[chartId] || []), newLine];
    
    setChartLines(prev => ({
      ...prev,
      [chartId]: updatedLines
    }));
    
    setNextLineIds(prev => ({
      ...prev,
      [chartId]: currentNextId + 1
    }));
    
    setCurrentLines(updatedLines);
  };

  // Удалить линию
  const removeLine = (lineId) => {
    if (!selectedNode || (selectedNode.type !== 'chartNode' && selectedNode.type !== 'radialChartNode')) return;
    
    const chartId = selectedNode.id;
    const updatedLines = (chartLines[chartId] || []).filter(line => line.id !== lineId);
    
    setChartLines(prev => ({
      ...prev,
      [chartId]: updatedLines
    }));
    
    setCurrentLines(updatedLines);
  };

  // Обновить параметры линии
  const updateLine = (lineId, field, value) => {
    if (!selectedNode || (selectedNode.type !== 'chartNode' && selectedNode.type !== 'radialChartNode')) return;
    
    const chartId = selectedNode.id;
    const updatedLines = (chartLines[chartId] || []).map(line => 
      line.id === lineId ? { ...line, [field]: value } : line
    );
    
    setChartLines(prev => ({
      ...prev,
      [chartId]: updatedLines
    }));
    
    setCurrentLines(updatedLines);
  };

  // Загрузить столбцы для выбранной таблицы линии (только метаданные, без данных)
  const loadColumnsForLine = async (lineId, tableName) => {
    if (!tableName) return;
    
    // Проверяем кэш
    if (tableColumnsCache[tableName]) {
      const columns = tableColumnsCache[tableName];
      const xAxis = columns.find(col => 
        col.toLowerCase().includes('time') || 
        col.toLowerCase().includes('date') ||
        col.toLowerCase().includes('timestamp')
      ) || columns[0] || '';
      
      const yAxis = columns.find(col => 
        col.toLowerCase().includes('value') || 
        col.toLowerCase().includes('current') ||
        col.toLowerCase().includes('voltage') ||
        col.toLowerCase().includes('measurement')
      ) || columns[1] || '';
      
      const angleAxis = columns.find(col => 
        col.toLowerCase().includes('angle') || 
        col.toLowerCase().includes('phase') ||
        col.toLowerCase().includes('deg')
      ) || columns[0] || '';
      
      const magnitudeAxis = columns.find(col => 
        col.toLowerCase().includes('magnitude') || 
        col.toLowerCase().includes('value') ||
        col.toLowerCase().includes('length')
      ) || columns[1] || '';
      
      const chartId = selectedNode.id;
      const updatedLines = currentLines.map(line => 
        line.id === lineId 
          ? { 
              ...line, 
              table: tableName,
              xAxis: xAxis,
              yAxis: yAxis,
              angleAxis: angleAxis,
              magnitudeAxis: magnitudeAxis,
              name: (selectedNode.type === 'radialChartNode' ? magnitudeAxis : yAxis) || line.name
            } 
          : line
      );
      setChartLines(prev => ({
        ...prev,
        [chartId]: updatedLines
      }));
      setCurrentLines(updatedLines);
      return;
    }
    
    try {
      const sql = `SELECT * FROM ${tableName} LIMIT 1`;
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
        
        // Сохраняем в кэш
        setTableColumnsCache(prev => ({
          ...prev,
          [tableName]: columns
        }));
        
        const xAxis = columns.find(col => 
          col.toLowerCase().includes('time') || 
          col.toLowerCase().includes('date') ||
          col.toLowerCase().includes('timestamp')
        ) || columns[0] || '';
        
        const yAxis = columns.find(col => 
          col.toLowerCase().includes('value') || 
          col.toLowerCase().includes('current') ||
          col.toLowerCase().includes('voltage') ||
          col.toLowerCase().includes('measurement')
        ) || columns[1] || '';
        
        const angleAxis = columns.find(col => 
          col.toLowerCase().includes('angle') || 
          col.toLowerCase().includes('phase') ||
          col.toLowerCase().includes('deg')
        ) || columns[0] || '';
        
        const magnitudeAxis = columns.find(col => 
          col.toLowerCase().includes('magnitude') || 
          col.toLowerCase().includes('value') ||
          col.toLowerCase().includes('length')
        ) || columns[1] || '';
        
        const chartId = selectedNode.id;
        const updatedLines = currentLines.map(line => 
          line.id === lineId 
            ? { 
                ...line, 
                table: tableName,
                xAxis: xAxis,
                yAxis: yAxis,
                angleAxis: angleAxis,
                magnitudeAxis: magnitudeAxis,
                name: (selectedNode.type === 'radialChartNode' ? magnitudeAxis : yAxis) || line.name
              } 
            : line
        );
        setChartLines(prev => ({
          ...prev,
          [chartId]: updatedLines
        }));
        setCurrentLines(updatedLines);
      }
    } catch (err) {
      console.error(`Ошибка загрузки столбцов для линии ${lineId}:`, err);
    }
  };

  // Применить все линии к графику (только метаданные, данные будут через GlobalDataStream)
  const applyAllLines = async () => {
    if (!selectedNode || currentLines.length === 0) {
      setChartParams(prev => ({
        ...prev,
        paramError: 'Добавьте хотя бы одну линию'
      }));
      return;
    }
    
    // Проверяем, что выбран узел графика
    if (selectedNode.type !== 'chartNode' && selectedNode.type !== 'radialChartNode') {
      setChartParams(prev => ({
        ...prev,
        paramError: 'Выберите график для применения линий'
      }));
      return;
    }
    
    // Проверяем, что все линии заполнены (в зависимости от типа графика)
    let invalidLines;
    if (selectedNode.type === 'radialChartNode') {
      invalidLines = currentLines.filter(line => !line.table || !line.angleAxis || !line.magnitudeAxis);
    } else {
      invalidLines = currentLines.filter(line => !line.table || !line.xAxis || !line.yAxis);
    }
    
    if (invalidLines.length > 0) {
      setChartParams(prev => ({
        ...prev,
        paramError: 'Заполните все параметры для каждой линии'
      }));
      return;
    }
    
    setChartParams(prev => ({ ...prev, isLoadingParams: true, paramError: '' }));
    
    try {
      const chartId = selectedNode.id;
      
      // Очищаем старые данные в линиях (новые данные придут из GlobalDataStream)
      const updatedLines = currentLines.map(line => ({
        ...line,
        data: [] // Очищаем данные, они загрузятся через GlobalDataStream
      }));
      
      setChartLines(prev => ({
        ...prev,
        [chartId]: updatedLines
      }));
      setCurrentLines(updatedLines);
      
      // Отправляем метаданные в узел (без данных)
      if (window.updateNodeData && selectedNode) {
        window.updateNodeData(selectedNode.id, {
          lines: updatedLines.map(({ data, ...rest }) => rest), // Отправляем без data
          timestamp: Date.now()
        });
      }
      
      setChartParams(prev => ({
        ...prev,
        paramError: '',
        isLoadingParams: false
      }));
      
      console.log(`Применено ${updatedLines.length} линий для ${selectedNode.type} #${selectedNode.id}`);
      
    } catch (err) {
      setChartParams(prev => ({
        ...prev,
        paramError: `Ошибка применения линий: ${err.message}`,
        isLoadingParams: false
      }));
    }
  };

  // Функция переключения сайдбара
  const toggleSidebar = useCallback(() => {
    if (isAnimating || isResizing) return;
    
    setIsAnimating(true);
    
    if (isCollapsed) {
      setIsCollapsed(false);
      setSidebarWidth(width);
    } else {
      setIsCollapsed(true);
      setSidebarWidth(minWidth);
    }
    
    setTimeout(() => {
      setIsAnimating(false);
    }, 300);
  }, [isCollapsed, isAnimating, isResizing, width, minWidth]);

  // Обработчик клика по свернутому сайдбару
  const handleSidebarClick = useCallback((e) => {
    if (isCollapsed && !isResizing && e.target.closest('.sidebar') && !e.target.closest('.sidebar-resizer')) {
      toggleSidebar();
    }
  }, [isCollapsed, isResizing, toggleSidebar]);

  // Безопасная установка ширины
  const safeSetWidth = useCallback((newWidth) => {
    if (resizeTimeoutRef.current) {
      cancelAnimationFrame(resizeTimeoutRef.current);
    }
    
    resizeTimeoutRef.current = requestAnimationFrame(() => {
      setSidebarWidth(newWidth);
    });
  }, []);

  // Обработчик начала ресайза
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isAnimating) return;
    
    setIsResizing(true);
    
    if (sidebarRef.current) {
      sidebarRef.current.classList.add('resizing-active');
    }
    
    const startX = e.clientX;
    const effectiveStartWidth = isCollapsed ? minWidth : sidebarWidth;
    
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
                    <i className="bi bi-bar-chart"></i> Линейный график
                  </button>
                  <button 
                    className="btn btn-outline-primary btn-sm w-100 mb-2"
                    onClick={onAddRadialChartNode}
                  >
                    <i className="bi bi-radar"></i> Радиальный график
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
                </div>
              </div>

              {/* Выбранный узел */}
              {selectedNode && (
                <div className="sidebar-section">
                  <h6 className="sidebar-section-title">
                    <i className="bi bi-node-plus"></i>
                    Параметры графика #{selectedNode.id}
                  </h6>
                  <div className="selected-node-info">
                    <div className="selected-node-header">
                      <span className="badge bg-primary">
                          {selectedNode.type === 'chartNode' && 'Линейный график'}
                          {selectedNode.type === 'radialChartNode' && 'Радиальный график'}
                          {selectedNode.type === 'dataSourceNode' && 'Источник'}
                          {selectedNode.type === 'processorNode' && 'Обработчик'}
                      </span>
                      <span className="ms-2">{selectedNode.data.label}</span>
                    </div>
                    <div className="selected-node-details">
                      {/* Блок управления линиями графика */}
                      <div className="chart-lines-manager mt-3">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={addLine}
                            disabled={chartParams.isLoadingParams}
                            title="Добавить новую линию"
                          >
                            <i className="bi bi-plus-circle me-1"></i>
                            Добавить серию
                          </button>
                        </div>
                        
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
                        
                        {/* Список линий */}
                        {currentLines.length === 0 ? (
                          <div className="text-center py-3" style={{ fontSize: '12px' }}>
                            <i className="bi bi-info-circle me-1"></i>
                            Для начала работы создайте серию
                          </div>
                        ) : (
                          <div className="lines-list">
                            {currentLines.map((line) => (
                              <div key={line.id} className="line-item card mb-2" style={{ fontSize: '12px' }}>
                                <div className="card-body p-2">
                                  {/* Заголовок линии с цветом и удалением */}
                                  <div className="d-flex justify-content-between align-items-center mb-2">
                                    <div className="d-flex align-items-center flex-grow-1">
                                      <input
                                        type="color"
                                        value={line.color}
                                        onChange={(e) => updateLine(line.id, 'color', e.target.value)}
                                        className="form-control form-control-color me-2"
                                        style={{ width: '30px', height: '30px', padding: '2px' }}
                                        title="Выбрать цвет"
                                      />
                                      <input
                                        type="text"
                                        value={line.name}
                                        onChange={(e) => updateLine(line.id, 'name', e.target.value)}
                                        className="form-control form-control-sm"
                                        placeholder="Название линии"
                                        style={{ fontSize: '12px' }}
                                      />
                                    </div>
                                    <button
                                      className="btn btn-sm btn-outline-danger ms-2"
                                      onClick={() => removeLine(line.id)}
                                      title="Удалить линию"
                                    >
                                      <i className="bi bi-trash"></i>
                                    </button>
                                  </div>
                                  
                                  {/* Выбор таблицы */}
                                  <div className="mb-2">
                                    <label className="form-label mb-1" style={{ fontSize: '11px' }}>Таблица:</label>
                                    <select 
                                      className="form-select form-select-sm"
                                      value={line.table}
                                      onChange={(e) => loadColumnsForLine(line.id, e.target.value)}
                                      disabled={chartParams.isLoadingParams}
                                      style={{ fontSize: '11px' }}
                                    >
                                      <option value="">Выберите таблицу...</option>
                                      {chartParams.tables.map(table => (
                                        <option key={table} value={table}>{table}</option>
                                      ))}
                                    </select>
                                  </div>
                                  
                                  {/* Выбор осей - зависит от типа графика */}
                                  {line.table && tableColumnsCache[line.table] && (
                                    <>
                                      {selectedNode.type === 'radialChartNode' ? (
                                        // Поля для радиального графика
                                        <>
                                          <div className="mb-2">
                                            <label className="form-label mb-1" style={{ fontSize: '11px' }}>Угол:</label>
                                            <select 
                                              className="form-select form-select-sm"
                                              value={line.angleAxis || ''}
                                              onChange={(e) => updateLine(line.id, 'angleAxis', e.target.value)}
                                              disabled={chartParams.isLoadingParams}
                                              style={{ fontSize: '11px' }}
                                            >
                                              <option value="">Выберите столбец...</option>
                                              {tableColumnsCache[line.table]?.map(column => (
                                                <option key={`${line.id}-angle-${column}`} value={column}>{column}</option>
                                              ))}
                                            </select>
                                          </div>
                                          
                                          <div className="mb-2">
                                            <label className="form-label mb-1" style={{ fontSize: '11px' }}>Длина:</label>
                                            <select 
                                              className="form-select form-select-sm"
                                              value={line.magnitudeAxis || ''}
                                              onChange={(e) => {
                                                updateLine(line.id, 'magnitudeAxis', e.target.value);
                                                if (e.target.value && line.name === `Линия ${line.id.split('-')[1]}`) {
                                                  updateLine(line.id, 'name', e.target.value);
                                                }
                                              }}
                                              disabled={chartParams.isLoadingParams}
                                              style={{ fontSize: '11px' }}
                                            >
                                              <option value="">Выберите столбец...</option>
                                              {tableColumnsCache[line.table]?.map(column => (
                                                <option key={`${line.id}-magnitude-${column}`} value={column}>{column}</option>
                                              ))}
                                            </select>
                                          </div>
                                        </>
                                      ) : (
                                        // Поля для линейного графика
                                        <>
                                          <div className="mb-2">
                                            <label className="form-label mb-1" style={{ fontSize: '11px' }}>Ось X:</label>
                                            <select 
                                              className="form-select form-select-sm"
                                              value={line.xAxis}
                                              onChange={(e) => updateLine(line.id, 'xAxis', e.target.value)}
                                              disabled={chartParams.isLoadingParams}
                                              style={{ fontSize: '11px' }}
                                            >
                                              <option value="">Выберите столбец...</option>
                                              {tableColumnsCache[line.table]?.map(column => (
                                                <option key={`${line.id}-x-${column}`} value={column}>{column}</option>
                                              ))}
                                            </select>
                                          </div>
                                          
                                          <div className="mb-2">
                                            <label className="form-label mb-1" style={{ fontSize: '11px' }}>Ось Y:</label>
                                            <select 
                                              className="form-select form-select-sm"
                                              value={line.yAxis}
                                              onChange={(e) => {
                                                updateLine(line.id, 'yAxis', e.target.value);
                                                if (e.target.value && line.name === `Линия ${line.id.split('-')[1]}`) {
                                                  updateLine(line.id, 'name', e.target.value);
                                                }
                                              }}
                                              disabled={chartParams.isLoadingParams}
                                              style={{ fontSize: '11px' }}
                                            >
                                              <option value="">Выберите столбец...</option>
                                              {tableColumnsCache[line.table]?.map(column => (
                                                <option key={`${line.id}-y-${column}`} value={column}>{column}</option>
                                              ))}
                                            </select>
                                          </div>
                                        </>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Кнопка применения */}
                        {currentLines.length > 0 && (
                          <div className="d-grid gap-2 mt-3">
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={applyAllLines}
                              disabled={chartParams.isLoadingParams || currentLines.length === 0}
                            >
                              {chartParams.isLoadingParams ? (
                                <>
                                  <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                                  Применение...
                                </>
                              ) : (
                                <>
                                  <i className="bi bi-check-circle me-1"></i>
                                  Применить параметры ({currentLines.length})
                                </>
                              )}
                            </button>
                          </div>
                        )}
                        
                        {/* Индикатор загрузки */}
                        {chartParams.isLoadingParams && (
                          <div className="text-center py-2">
                            <div className="spinner-border spinner-border-sm text-primary" role="status">
                              <span className="visually-hidden">Загрузка...</span>
                            </div>
                            <small className="text-muted d-block mt-1">Применение параметров...</small>
                          </div>
                        )}

                        {/* Информация о том, откуда берутся данные */}
                        <div className="alert alert-info py-1 px-2 mt-2" style={{ fontSize: '10px' }}>
                          <i className="bi bi-info-circle me-1"></i>
                          Данные будут автоматически загружаться через глобальный стрим после включения автообновления на графике
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Ресайзер */}
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