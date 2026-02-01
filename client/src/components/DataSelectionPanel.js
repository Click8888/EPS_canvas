import React, { useState, useRef, useEffect } from 'react';

const normalizeId = (id) => {
  if (id === null || id === undefined || id === '') return null;
  return typeof id === 'string' ? parseInt(id, 10) : id;
};

const DataSelectionPanel = ({ 
  show, 
  onClose, 
  onSelectParameters, 
  availableParameters, 
  charts, 
  selectedChartId, 
  onSelectChart 
}) => {
  const [selectedParams, setSelectedParams] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastError, setLastError] = useState(null);
  const [panelHeight, setPanelHeight] = useState(400);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef(null);
  const resizeHandleRef = useRef(null);

  // Загрузка выбранных параметров для текущего графика
  useEffect(() => {
    if (selectedChartId) {
      const chart = charts.find(c => c.id === normalizeId(selectedChartId));
      if (chart && chart.selectedParameters) {
        setSelectedParams(chart.selectedParameters);
      }
    } else {
      setSelectedParams([]);
    }
  }, [selectedChartId, charts]);

  const handleParameterToggle = (parameter) => {
    setSelectedParams(prev => 
      prev.includes(parameter)
        ? prev.filter(p => p !== parameter)
        : [...prev, parameter]
    );
  };

  const handleSelectAll = () => {
    setSelectedParams([...availableParameters]);
  };

  const handleDeselectAll = () => {
    setSelectedParams([]);
  };

  const handleApply = async () => {
    if (selectedParams.length === 0) {
      setLastError("Выберите хотя бы один параметр");
      return;
    }

    setIsLoading(true);
    setLastError(null);

    try {
      await onSelectParameters(selectedParams, selectedChartId);
      onClose();
    } catch (error) {
      setLastError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResizeStart = (e) => {
    e.preventDefault();
    setIsResizing(true);
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', handleResizeEnd);
  };

  const handleResize = (e) => {
    if (!isResizing) return;
    
    const newHeight = window.innerHeight - e.clientY;
    
    if (newHeight > 300 && newHeight < window.innerHeight - 100) {
      setPanelHeight(newHeight);
    }
  };

  const handleResizeEnd = () => {
    setIsResizing(false);
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', handleResizeEnd);
  };

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleResize);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  }, []);

  if (!show) return null;

  return (
    <div 
      ref={panelRef}
      className="sql-panel-grafana"
      style={{ height: `${panelHeight}px` }}
    >
      <div 
        ref={resizeHandleRef}
        className="sql-panel-resize-handle"
        onMouseDown={handleResizeStart}
        style={{ cursor: isResizing ? 'ns-resize' : 'row-resize' }}
      >
        <i className="bi bi-dash"></i>
      </div>

      <div className="sql-panel-header-grafana">
        <div className="sql-panel-title">
          <i className="bi bi-sliders me-2"></i>
          <span>Выбор данных</span>
        </div>
      </div>

      <div className="sql-panel-content-grafana" style={{ height: `calc(100% - 120px)` }}>
        <div className="sql-editor-container h-100">
          <div className="sql-editor-header">
            <span className="sql-editor-tab active">Доступные параметры</span>
          </div>
          
          <div className="chart-selector-container">
            <select 
              className="form-select form-select-sm"
              value={selectedChartId || ''}
              onChange={(e) => onSelectChart(e.target.value || null)}
              disabled={charts.length === 0 || isLoading}
            >
              <option value="">Все графики</option>
              {charts.map((chart, index) => (
                <option key={chart.id} value={chart.id}>
                  График #{index + 1} - {chart.type === 'linear' ? 'Линейный' : 'Векторный'}
                </option>
              ))}
            </select>
          </div>

          <div className="sql-editor h-100 p-3" style={{ overflowY: 'auto' }}>
            <div className="d-flex justify-content-between mb-3">
              <button 
                className="btn btn-sm btn-outline-secondary"
                onClick={handleSelectAll}
                disabled={isLoading}
              >
                Выбрать все
              </button>
              <button 
                className="btn btn-sm btn-outline-secondary"
                onClick={handleDeselectAll}
                disabled={isLoading}
              >
                Сбросить все
              </button>
            </div>

            <div className="parameters-list">
              {availableParameters.length === 0 ? (
                <div className="text-muted text-center p-3">
                  <i className="bi bi-info-circle me-2"></i>
                  Нет доступных параметров
                </div>
              ) : (
                availableParameters.map((param, index) => (
                  <div key={index} className="form-check mb-2">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id={`param-${index}`}
                      checked={selectedParams.includes(param)}
                      onChange={() => handleParameterToggle(param)}
                      disabled={isLoading}
                    />
                    <label 
                      className="form-check-label text-white"
                      htmlFor={`param-${index}`}
                      style={{ fontSize: '14px' }}
                    >
                      {param}
                    </label>
                  </div>
                ))
              )}
            </div>

            {selectedParams.length > 0 && (
              <div className="selected-count mt-3">
                <small className="text-muted">
                  Выбрано: {selectedParams.length} параметр(ов)
                </small>
              </div>
            )}
          </div>
        </div>

        <div className="sql-panel-sidebar">
          <div className="sidebar-section">
            <h6>Информация</h6>
            <div className="text-muted small">
              <p>Выберите параметры для отображения на графике.</p>
              <p>Можно выбрать несколько параметров для сравнения.</p>
            </div>
          </div>
        </div>
      </div>

      {lastError && (
        <div className="sql-panel-error alert alert-danger m-2 mb-0">
          <i className="bi bi-exclamation-triangle me-2"></i>
          {lastError}
        </div>
      )}

      <div className="sql-panel-footer-grafana">
        <div className="footer-left">
          <small className="text-muted">
            <i className="bi bi-info-circle me-1"></i>
            {selectedChartId 
              ? `Данные будут применены к выбранному графику` 
              : `Данные будут применены ко всем графикам`}
          </small>
        </div>
        <div className="footer-right">
          <button
            className="btn btn-sm btn-secondary me-2"
            onClick={onClose}
            disabled={isLoading}
          >
            Отмена
          </button>
          <button
            className="btn btn-sm btn-primary"
            onClick={handleApply}
            disabled={selectedParams.length === 0 || isLoading}
          >
            {isLoading ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                Загрузка...
              </>
            ) : (
              <>
                <i className="bi bi-check-lg me-1"></i>
                Применить
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataSelectionPanel;