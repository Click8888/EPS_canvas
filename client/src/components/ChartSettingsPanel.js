import React, { useState, useEffect } from 'react';

const ChartSettingsPanel = ({ show, chart, charts, onClose, onSettingsUpdate, availableFields }) => {
  const [settings, setSettings] = useState({
    xAxis: 'Measurement_time',
    yAxis: 'Current_value'
  });

  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (chart && chart.settings) {
      setSettings({
        xAxis: chart.settings.xAxis || 'Measurement_time',
        yAxis: chart.settings.yAxis || 'Current_value'
      });
    }
  }, [chart]);

  // Анимация появления/исчезновения панели
  useEffect(() => {
    if (show) {
      setIsVisible(true);
    } else {
      // Задержка для анимации исчезновения
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [show]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && show) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [show, onClose]);

  const handleSave = () => {
    if (chart) {
      onSettingsUpdate(chart.id, settings);
    }
    onClose();
  };

  const handleChange = (field, value) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (!isVisible && !show) return null;

  return (
    <div className={`chart-settings-panel-container ${show ? 'show' : ''}`}>
      <div className="chart-settings-panel">
        <div className="chart-settings-header">
          <h5>
            <i className="bi bi-sliders me-2"></i>
            Настройки графика {chart ? `#${charts.findIndex(c => c.id === chart.id) + 1}` : ''}
          </h5>
          <button 
            type="button" 
            className="btn-close btn-close-white" 
            onClick={onClose}
            aria-label="Закрыть"
          ></button>
        </div>
        
        <div className="chart-settings-body">
          <div className="row">
            <div className="col-md-6 mb-3">
              <label className="form-label">Ось X (Время)</label>
              <select
                className="form-select"
                value={settings.xAxis}
                onChange={(e) => handleChange('xAxis', e.target.value)}
              >
                {availableFields.map(field => (
                  <option key={`x-${field}`} value={field}>
                    {field}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="col-md-6 mb-3">
              <label className="form-label">Ось Y (Значение)</label>
              <select
                className="form-select"
                value={settings.yAxis}
                onChange={(e) => handleChange('yAxis', e.target.value)}
              >
                {availableFields.map(field => (
                  <option key={`y-${field}`} value={field}>
                    {field}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {chart && chart.rawData && chart.rawData.length > 0 && (
            <div className="settings-preview">
              <h6>Предпросмотр данных:</h6>
              <div className="preview-content">
                <div className="row">
                  <div className="col-md-6">
                    <small className="text-muted">
                      <strong>Первая запись:</strong><br />
                      <strong>X ({settings.xAxis}):</strong> {chart.rawData[0][settings.xAxis] || 'N/A'}<br />
                      <strong>Y ({settings.yAxis}):</strong> {chart.rawData[0][settings.yAxis] || 'N/A'}
                    </small>
                  </div>
                  <div className="col-md-6">
                    <small className="text-muted">
                      <strong>Последняя запись:</strong><br />
                      <strong>X ({settings.xAxis}):</strong> {chart.rawData[chart.rawData.length - 1][settings.xAxis] || 'N/A'}<br />
                      <strong>Y ({settings.yAxis}):</strong> {chart.rawData[chart.rawData.length - 1][settings.yAxis] || 'N/A'}
                    </small>
                  </div>
                </div>
                <div className="mt-2">
                  <small className="text-muted">
                    Всего записей: {chart.rawData.length}
                  </small>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="chart-settings-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Отмена
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave}>
            Применить настройки
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChartSettingsPanel;