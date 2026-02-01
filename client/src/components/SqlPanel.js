import React, { useState, useEffect, useCallback } from 'react';
import '../App.css';

// Helper function
const normalizeId = (id) => {
  if (id === null || id === undefined || id === '') return null;
  return typeof id === 'string' ? parseInt(id, 10) : id;
};

// Компонент для отображения ошибок с возможностью закрытия
const ErrorAlert = ({ error, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    setIsVisible(true);
  }, [error]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose(), 300);
  };

  if (!error || !isVisible) return null;

  return (
    <div className="sql-panel-error alert alert-danger m-0 alert-dismissible fade show">
      <i className="bi bi-exclamation-triangle me-2"></i>
      {error}
      <button
        type="button"
        className="btn-close btn-close-white"
        onClick={handleClose}
        aria-label="Close"
      ></button>
    </div>
  );
};

// Компонент для настройки отдельной серии
const SeriesSettings = ({ series, chart, onUpdate, onRemove, onExecute, tableNames, columnsByTable }) => {
  // Используем selectedTable из series, а не из chart
  const availableColumns = series.selectedTable ? 
    columnsByTable[series.selectedTable] || [] : [];

  const generateQuery = () => {
    if (!series.selectedTable || !series.xAxis || !series.yAxis) {
      alert('Выберите таблицу и обе оси для генерации запроса');
      return;
    }

    return `SELECT ${series.xAxis}, ${series.yAxis} FROM ${series.selectedTable}`;
  };

  const handleExecuteQuery = () => {
    const query = generateQuery();
    if (query) {
      onExecute(query, chart.id, series.id);
    }
  };

  const handleTableChange = (tableName) => {
    onUpdate({ 
      selectedTable: tableName,
      // Сбрасываем оси при смене таблицы
      xAxis: '',
      yAxis: ''
    });
  };

  return (
    <div className="series-settings p-3 mb-3 bg-dark rounded" style={{ border: '1px solid #555' }}>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <input
          type="text"
          className="form-control form-control-sm bg-secondary text-white border-dark me-2"
          value={series.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="Название серии"
          style={{ maxWidth: '200px' }}
        />
        <div className="btn-group btn-group-sm">
          <button
            className="btn btn-outline-primary"
            onClick={handleExecuteQuery}
            title="Выполнить запрос для этой серии"
            disabled={!series.selectedTable || !series.xAxis || !series.yAxis}
          >
            <i className="bi bi-play-fill"></i>
          </button>
          <button
            className="btn btn-outline-danger"
            onClick={onRemove}
            title="Удалить серию"
          >
            <i className="bi bi-trash"></i>
          </button>
        </div>
      </div>

      {/* Выбор таблицы для серии */}
      <div className="row g-2 mb-2">
        <div className="col-12">
          <label className="form-label small text-white">Таблица для серии</label>
          <select
            className="form-select form-select-sm bg-secondary text-light border-dark"
            value={series.selectedTable || ''}
            onChange={(e) => handleTableChange(e.target.value)}
          >
            <option value="">Выберите таблицу</option>
            {tableNames.map(tableName => (
              <option key={tableName} value={tableName}>
                {tableName}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="row g-2">
        <div className="col-md-4">
          <label className="form-label small text-white">Ось X</label>
          <select
            className="form-select form-select-sm bg-secondary text-light border-dark"
            value={series.xAxis || ''}
            onChange={(e) => onUpdate({ xAxis: e.target.value })}
            disabled={!series.selectedTable}
          >
            <option value="">Выберите столбец</option>
            {availableColumns.map(column => (
              <option key={column} value={column}>
                {column}
              </option>
            ))}
          </select>
        </div>

        <div className="col-md-4">
          <label className="form-label small text-white">Ось Y</label>
          <select
            className="form-select form-select-sm bg-secondary text-light border-dark"
            value={series.yAxis || ''}
            onChange={(e) => onUpdate({ yAxis: e.target.value })}
            disabled={!series.selectedTable}
          >
            <option value="">Выберите столбец</option>
            {availableColumns.map(column => (
              <option key={column} value={column}>
                {column}
              </option>
            ))}
          </select>
        </div>

        <div className="col-md-4">
          <label className="form-label small text-white">Цвет</label>
          <div className="d-flex align-items-center">
            <input
              type="color"
              className="form-control form-control-color form-control-sm bg-secondary border-dark me-2"
              value={series.color || '#ff0000'}
              onChange={(e) => onUpdate({ color: e.target.value })}
              style={{ width: '30px', height: '30px' }}
            />
            <select
              className="form-select form-select-sm bg-secondary text-light border-dark"
              value={series.style || 'solid'}
              onChange={(e) => onUpdate({ style: e.target.value })}
            >
              <option value="solid">Сплошная</option>
              <option value="dashed">Пунктир</option>
            </select>
          </div>
        </div>
      </div>

      {series.selectedTable && series.xAxis && series.yAxis && (
        <div className="mt-2 p-2 bg-secondary rounded">
          <small className="text-white">SQL запрос:</small>
          <code className="d-block text-info small">
            SELECT {series.xAxis}, {series.yAxis} FROM {series.selectedTable}
          </code>
        </div>
      )}
    </div>
  );
};

// Компонент для настройки параметров графика
const ChartSettings = ({ 
  chart, 
  charts, 
  onExecute, 
  onSave, 
  onDelete, 
  tableNames,
  columnsByTable,
  chartSeries = {},
  onAddSeries = () => {},
  onRemoveSeries = () => {},
  onUpdateSeries = () => {},
  onExecuteQuery = () => {},
  isUpdating,
  onChartTitleChange = () => {}
}) => {
  const [editingTitle, setEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(chart.title || '');

  // Получаем доступные колонки для выбранной таблицы
  const availableColumns = chart.selectedTable ? 
    columnsByTable[chart.selectedTable] || [] : [];

  const handleTitleSave = () => {
    if (tempTitle.trim()) {
      onChartTitleChange(chart.id, tempTitle.trim());
      onSave({ ...chart, title: tempTitle.trim() });
    }
    setEditingTitle(false);
  };

  const handleTitleCancel = () => {
    setTempTitle(chart.title || '');
    setEditingTitle(false);
  };

  const handleTableChange = (tableName) => {
    const updatedChart = {
      ...chart,
      selectedTable: tableName,
      // Не сбрасываем оси, если они могут существовать в новой таблице
      xAxis: chart.xAxis && columnsByTable[tableName]?.includes(chart.xAxis) ? chart.xAxis : '',
      yAxis: chart.yAxis && columnsByTable[tableName]?.includes(chart.yAxis) ? chart.yAxis : ''
    };
    onSave(updatedChart);
  };

  const handleFieldChange = (field, value) => {
    const updatedChart = {
      ...chart,
      [field]: value
    };
    onSave(updatedChart);
  };

  const generateQuery = () => {
    if (!chart.selectedTable || !chart.xAxis || !chart.yAxis) {
      alert('Выберите таблицу и обе оси для генерации запроса');
      return;
    }

    return `SELECT ${chart.xAxis}, ${chart.yAxis} FROM ${chart.selectedTable}`;
  };

  const handleExecuteQuery = () => {
    const query = generateQuery();
    if (query) {
      onExecute(query, chart.id);
    }
  };

  // Получаем серии для текущего графика
  const series = chartSeries[chart.id] || [];

  const handleAddSeries = () => {
    onAddSeries(chart.id, {
      name: `Серия ${series.length + 1}`,
      selectedTable: chart.selectedTable || '',
      xAxis: '',
      yAxis: '',
      color: `hsl(${Math.random() * 360}, 70%, 60%)`,
      width: 2,
      style: 'solid',
      enabled: true,
      data: []
    });
  };

  return (
    <div className="chart-settings-item p-3 mb-3 rounded bg-dark" style={{ border: '1px solid #444' }}>
      <div className="d-flex justify-content-between align-items-start mb-3">
        {editingTitle ? (
          <div className="d-flex align-items-center flex-grow-1 me-2">
            <input
              type="text"
              className="form-control form-control-sm bg-secondary text-white border-dark me-2"
              value={tempTitle}
              onChange={(e) => setTempTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTitleSave();
                if (e.key === 'Escape') handleTitleCancel();
              }}
              onBlur={handleTitleSave}
              autoFocus
              style={{ maxWidth: '200px' }}
            />
            <button
              className="btn btn-success btn-sm"
              onClick={handleTitleSave}
              title="Сохранить"
            >
              <i className="bi bi-check"></i>
            </button>
            <button
              className="btn btn-secondary btn-sm ms-1"
              onClick={handleTitleCancel}
              title="Отменить"
            >
              <i className="bi bi-x"></i>
            </button>
          </div>
        ) : (
          <>
            <span 
              className="text-white fw-bold me-2" 
              style={{ maxWidth: '200px', cursor: 'pointer' }}
              onClick={() => setEditingTitle(true)}
              title="Кликните для редактирования названия"
            >
              {chart.title || `График ${charts.findIndex(c => c.id === chart.id) + 1}`}
            </span>
            <div className="btn-group btn-group-sm">
              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setEditingTitle(true)}
                title="Редактировать название"
              >
                <i className="bi bi-pencil"></i>
              </button>
              <button
                className="btn btn-outline-primary"
                onClick={handleExecuteQuery}
                title="Выполнить запрос"
                disabled={!chart.selectedTable || !chart.xAxis || !chart.yAxis}
              >
                <i className="bi bi-play-fill"></i>
              </button>
              <button
                className="btn btn-outline-danger"
                onClick={() => onDelete(chart.id)}
                title="Удалить график"
              >
                <i className="bi bi-trash"></i>
              </button>
            </div>
          </>
        )}
      </div>
      
      <div className="row">
        <div className="col-md-6">
          <div className='text-center text-white mb-2'>
            <h6>Данные графика</h6>
          </div>
          
          {/* Выбор таблицы */}
          <div className="mb-2">
            <label className="form-label small text-white">Таблица</label>
            <select
              className="form-select form-select-sm bg-secondary text-light border-dark"
              value={chart.selectedTable || ''}
              onChange={(e) => handleTableChange(e.target.value)}
            >
              <option value="">Выберите таблицу</option>
              {tableNames.map(tableName => (
                <option key={tableName} value={tableName}>
                  {tableName}
                </option>
              ))}
            </select>
          </div>

          {/* Ось X */}
          <div className="mb-2">
            <label className="form-label small text-white">Ось X</label>
            <select
              className="form-select form-select-sm bg-secondary text-light border-dark"
              value={chart.xAxis || ''}
              onChange={(e) => handleFieldChange('xAxis', e.target.value)}
              disabled={!chart.selectedTable}
            >
              <option value="">Выберите столбец</option>
              {availableColumns.map(column => (
                <option key={column} value={column}>
                  {column}
                </option>
              ))}
            </select>
          </div>

          {/* Ось Y */}
          <div className="mb-2">
            <label className="form-label small text-white">Ось Y</label>
            <select
              className="form-select form-select-sm bg-secondary text-light border-dark"
              value={chart.yAxis || ''}
              onChange={(e) => handleFieldChange('yAxis', e.target.value)}
              disabled={!chart.selectedTable}
            >
              <option value="">Выберите столбец</option>
              {availableColumns.map(column => (
                <option key={column} value={column}>
                  {column}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="col-md-6">
          <div className='text-center text-white mb-2'>
            <h6>Внешний вид</h6>
          </div>
          
          <div className="mb-2">
            <label className="form-label small text-white">Интервал обновления (мс)</label>
            <input
              type="number"
              className="form-control form-control-sm bg-secondary text-light border-dark"
              value={chart.refreshInterval || 100}
              onChange={(e) => handleFieldChange('refreshInterval', parseInt(e.target.value) || 100)}
              min="0"
              max="10000"
            />
          </div>
          
          <div className="mb-2">
            <label className="form-label small text-white">Цвет линии графика</label>
            <div className="d-flex align-items-center">
              <input
                type="color"
                className="form-control form-control-color form-control-sm bg-secondary border-dark me-2"
                value={chart.color || '#133592ff'}
                onChange={(e) => handleFieldChange('color', e.target.value)}
                style={{ width: '40px', height: '30px' }}
              />
              <span className="small text-muted">{chart.color || '#133592ff'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Сгенерированный SQL запрос для основного графика */}
      {chart.selectedTable && chart.xAxis && chart.yAxis && (
        <div className="mt-3 p-2 bg-secondary rounded">
          <small className="text-white">SQL запрос для основного графика:</small>
          <code className="d-block text-info small mt-1">
            SELECT {chart.xAxis}, {chart.yAxis} FROM {chart.selectedTable}
          </code>
        </div>
      )}

      {/* Секция дополнительных серий */}
      <div className="mt-4 pt-3 border-top border-secondary">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h6 className="text-white mb-0">
            Дополнительные серии данных
            <span className="badge bg-primary ms-2">{series.length}</span>
          </h6>
          <button
            className="btn btn-sm btn-outline-primary"
            onClick={handleAddSeries}
            title="Добавить новую серию данных"
            disabled={!chart.selectedTable}
          >
            <i className="bi bi-plus-lg me-1"></i>
            Добавить серию
          </button>
        </div>

        {series.length === 0 ? (
          <div className="text-muted small p-3 text-center bg-secondary rounded">
            <i className="bi bi-info-circle me-1"></i>
            Нет добавленных серий. Нажмите "Добавить серию" чтобы создать дополнительную серию данных.
          </div>
        ) : (
          <div className="series-list">
            {series.map(seriesItem => (
              <SeriesSettings
                key={seriesItem.id}
                series={seriesItem}
                chart={chart}
                onUpdate={(updates) => onUpdateSeries(chart.id, seriesItem.id, updates)}
                onRemove={() => onRemoveSeries(chart.id, seriesItem.id)}
                onExecute={onExecuteQuery}
                tableNames={tableNames}
                columnsByTable={columnsByTable}
              />
            ))}
          </div>
        )}

        {series.length > 0 && (
          <div className="mt-2 text-info small">
            <i className="bi bi-lightbulb me-1"></i>
            Каждая серия может использовать разные столбцы из выбранной таблицы
          </div>
        )}
      </div>
    </div>
  );
};

const SqlPanel = ({ 
  show, 
  onClose, 
  onExecuteQuery, 
  charts, 
  selectedChartId, 
  onSelectChart, 
  onUpdateToggle, 
  updatingCharts, 
  onRemoveChart, 
  tableNames,
  columnsByTable,
  setCharts,
  chartSeries = {},
  onAddSeries = () => console.log('addSeries not provided'),
  onRemoveSeries = () => console.log('removeSeries not provided'),
  onUpdateSeries = () => console.log('updateSeries not provided'),
  onChartTitleChange = () => console.log('onChartTitleChange not provided'),
  isGenerating = false,
  onStartGeneration = () => console.log('startGeneration not provided'),
  onStopGeneration = () => console.log('stopGeneration not provided'),
  generationStatus = 'stopped'
}) => {
  const [queryHistory, setQueryHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastError, setLastError] = useState(null);

  useEffect(() => {
    if (show) {
      // Инициализация при открытии панели
    }
  }, [show]);

  const handleCloseError = useCallback(() => {
    setLastError(null);
  }, []);

  const handleExecute = useCallback(async (query, chartId = null) => {
    if (!query) return;
    
    setIsLoading(true);
    setLastError(null);

    try {
      const normalizedChartId = normalizeId(chartId);
      await onExecuteQuery(query, normalizedChartId);
      
      setQueryHistory(prev => [{
        query: query,
        name: `Запрос для графика ${charts.findIndex(c => c.id === chartId) + 1}`,
        timestamp: new Date().toLocaleTimeString(),
        success: true,
        chartId: normalizedChartId
      }, ...prev.slice(0, 9)]);
      
    } catch (error) {
      setLastError(error.message);
      setQueryHistory(prev => [{
        query: query,
        name: `Запрос для графика ${charts.findIndex(c => c.id === chartId) + 1}`,
        timestamp: new Date().toLocaleTimeString(),
        success: false,
        error: error.message,
        chartId: normalizeId(chartId)
      }, ...prev.slice(0, 9)]);
    } finally {
      setIsLoading(false);
    }
  }, [charts, onExecuteQuery]);

  const handleHistoryClick = useCallback((historyItem) => {
    if (historyItem.chartId) {
      onSelectChart(historyItem.chartId);
    }
    setLastError(null);
  }, [onSelectChart]);

  const handleSaveSettings = useCallback((updatedChart) => {
    // Обновляем график в основном состоянии
    setCharts(prev => prev.map(chart => 
      chart.id === updatedChart.id ? { ...chart, ...updatedChart } : chart
    ));
    
    console.log('Настройки графика сохранены:', updatedChart);
  }, [setCharts]);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'Escape' && show) {
        onClose();
      }
    };

    if (show) {
      document.addEventListener('keydown', handleKeyPress);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div className="sql-panel-grafana" style={{ height: '500px' }}>
      <div className="sql-panel-header-grafana">
        <div className="sql-panel-title">
          <i className="bi bi-sliders me-2"></i>
          <span>Настройки графиков ({charts.length})</span>
        </div>
        
        {/* КНОПКИ УПРАВЛЕНИЯ ГЕНЕРАЦИЕЙ ДАННЫХ */}
        <div className="generation-controls ms-auto me-3">
          <div className="btn-group btn-group-sm" role="group">
            {!isGenerating ? (
              <button
                className="btn btn-success"
                onClick={onStartGeneration}
                title="Запустить генерацию тестовых данных"
                disabled={isGenerating}
              >
                <i className="bi bi-play-fill me-1"></i>
                Запустить генерацию
              </button>
            ) : (
              <button
                className="btn btn-danger"
                onClick={onStopGeneration}
                title="Остановить генерацию данных"
              >
                <i className="bi bi-stop-fill me-1"></i>
                Остановить
              </button>
            )}
          </div>
          
          <span className={`badge ms-2 ${isGenerating ? 'bg-success' : 'bg-secondary'}`}>
            <i className={`bi ${isGenerating ? 'bi-arrow-repeat' : 'bi-pause'}`}></i>
            {isGenerating ? ' Активно' : ' Остановлено'}
          </span>
        </div>

        <div className="resize-controls">
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={onClose}
            title="Закрыть панель"
          >
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
      </div>

      <div className="sql-panel-content-grafana">
        <div className="sql-editor-container h-100">
          <div className="sql-editor" style={{ overflowY: 'auto', padding: '10px' }}>
            {charts.length === 0 ? (
              <div className="text-center text-muted py-4">
                <i className="bi bi-bar-chart display-4 mb-3 text-white"></i>
                <h6 className="text-white">Нет добавленных графиков</h6>
                <p className="text-white-50 small mt-2">
                  Добавьте графики и настройку генерацию данных с помощью кнопок выше
                </p>
              </div>
            ) : (
              <div className="chart-settings-list">
                {charts.map((chart) => (
                  <ChartSettings
                    key={chart.id}
                    chart={chart}
                    charts={charts}
                    onExecute={handleExecute}
                    onSave={handleSaveSettings}
                    onDelete={onRemoveChart}
                    onUpdateToggle={onUpdateToggle}
                    updatingCharts={updatingCharts}
                    tableNames={tableNames}
                    columnsByTable={columnsByTable}
                    chartSeries={chartSeries}
                    onAddSeries={onAddSeries}
                    onRemoveSeries={onRemoveSeries}
                    onUpdateSeries={onUpdateSeries}
                    onExecuteQuery={onExecuteQuery}
                    isUpdating={updatingCharts.has(chart.id)}
                    onChartTitleChange={onChartTitleChange}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="sql-panel-sidebar">
          <div className="sidebar-section">
            <h6>
              <i className="bi bi-clock-history me-2"></i>
              История запросов
            </h6>
            <div className="query-history-grafana text-white">
              {queryHistory.length === 0 ? (
                <div className="text-white small p-2 ">История запросов пуста</div>
              ) : (
                queryHistory.map((item, index) => (
                  <div
                    key={index}
                    className={`history-item-grafana ${item.success ? '' : 'history-error'}`}
                    onClick={() => handleHistoryClick(item)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="history-query">
                      <i className={`bi bi-${item.success ? 'check' : 'x'}-circle-fill text-${item.success ? 'success' : 'danger'} me-2`}></i>
                      {item.name}
                    </div>
                    <div className="history-time text-muted small">
                      {item.timestamp}
                      {item.chartId && (
                        <div className="text-info small">
                          График: {charts.findIndex(c => c.id === item.chartId) + 1}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* СТАТУС ГЕНЕРАЦИИ ДАННЫХ */}
          <div className="sidebar-section mt-3">
            <h6>
              <i className="bi bi-database me-2"></i>
              Статус генерации
            </h6>
            <div className={`p-2 rounded ${isGenerating ? 'bg-success' : 'bg-secondary'}`}>
              <div className="d-flex align-items-center">
                <i className={`bi ${isGenerating ? 'bi-arrow-repeat' : 'bi-pause-fill'} me-2`}></i>
                <span className="small">
                  {isGenerating ? 'Данные генерируются' : 'Генерация остановлена'}
                </span>
              </div>
              {isGenerating && (
                <div className="mt-1">
                  <div className="progress" style={{ height: '4px' }}>
                    <div 
                      className="progress-bar progress-bar-striped progress-bar-animated" 
                      style={{ width: '100%' }}
                    ></div>
                  </div>
                  <small className="text-white-50">В реальном времени</small>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="sql-panel-loading">
          <div className="spinner-border spinner-border-sm text-primary me-2" role="status">
            <span className="visually-hidden">Загрузка...</span>
          </div>
          <span>Выполнение запроса...</span>
        </div>
      )}

      <ErrorAlert error={lastError} onClose={handleCloseError} />

      <div className="sql-panel-footer-grafana">
        <div className="footer-left">
          
        </div>
        <div className="footer-right">
          <button
            className="btn btn-sm btn-secondary"
            onClick={onClose}
            disabled={isLoading}
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

export default SqlPanel;