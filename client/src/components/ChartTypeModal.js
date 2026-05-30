// ChartTypeModal.js
import React from 'react';

const ChartTypeModal = ({ show, onClose, selectedChartType, onChartTypeChange, onAddChart }) => {
  if (!show) return null;

  const typeNames = {
    'linear': 'Линейный график',
    'vector': 'Векторная диаграмма'
  };

  return (
    <div className="modal fade show d-block" tabIndex="-1" style={{ 
      backgroundColor: 'rgba(0,0,0,0.5)', 
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1050,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Выберите тип графика</h5>
            <button 
              type="button" 
              className="btn-close" 
              onClick={onClose}
              aria-label="Close"
            ></button>
          </div>
          <div className="modal-body">
            <div className="form-check mb-3">
              <input
                className="form-check-input"
                type="radio"
                name="chartType"
                id="linearChart"
                value="linear"
                checked={selectedChartType === 'linear'}
                onChange={(e) => onChartTypeChange(e.target.value)}
              />
              <label className="form-check-label" htmlFor="linearChart">
                {typeNames.linear}
              </label>
            </div>
            <div className="form-check">
              <input
                className="form-check-input"
                type="radio"
                name="chartType"
                id="vectorChart"
                value="vector"
                checked={selectedChartType === 'vector'}
                onChange={(e) => onChartTypeChange(e.target.value)}
              />
              <label className="form-check-label" htmlFor="vectorChart">
                {typeNames.vector}
              </label>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Отмена
            </button>
            <button type="button" className="btn btn-primary" onClick={onAddChart}>
              Добавить {typeNames[selectedChartType]}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChartTypeModal;