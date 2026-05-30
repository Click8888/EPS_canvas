import React, { useState } from 'react';
import Chart from './Chart';

const ChartsContainer = ({ 
  charts, 
  onRemoveChart,
  onUpdateToggle,
  updatingCharts,
  onChartTitleChange
}) => {
  const [editingChartId, setEditingChartId] = useState(null);
  const [editTitleValue, setEditTitleValue] = useState('');

  const handleTitleEditStart = (chart) => {
    setEditingChartId(chart.id);
    setEditTitleValue(chart.title || `График #${charts.findIndex(c => c.id === chart.id) + 1}`);
  };
  
  const handleTitleEditSave = (chartId) => {
    if (editTitleValue.trim()) {
      onChartTitleChange(chartId, editTitleValue.trim());
    }
    setEditingChartId(null);
    setEditTitleValue('');
  };

  const handleTitleEditCancel = () => {
    setEditingChartId(null);
    setEditTitleValue('');
  };

  const handleKeyPress = (e, chartId) => {
    if (e.key === 'Enter') {
      handleTitleEditSave(chartId);
    } else if (e.key === 'Escape') {
      handleTitleEditCancel();
    }
  };

  return (
    <div className="charts-main-container">
      {charts.length === 0 ? (
        <div className="charts-empty-state">
          <div className="text-center text-white">
            <i className="bi bi-bar-chart-fill display-4 mb-3"></i>
            <h4>Нет добавленных графиков</h4>
            <p className="text-white">Нажмите на кнопку ниже, чтобы добавить первый график</p>
          </div>
        </div>
      ) : (
        <div className="charts-grid">
          {charts.map((chart, index) => {
            const isUpdating = updatingCharts.has(chart.id);
            const isEditing = editingChartId === chart.id;
            const displayTitle = chart.title || `График #${index + 1}`;

            return (
              <div 
                key={`chart-${chart.id}-${index}`}
                className="chart-item"
              >
                <div className="chart-wrapper">
                  <div className="chart-header">
                    {isEditing ? (
                      <div className="d-flex align-items-center flex-grow-1 me-2">
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={editTitleValue}
                          onChange={(e) => setEditTitleValue(e.target.value)}
                          onKeyDown={(e) => handleKeyPress(e, chart.id)}
                          onBlur={() => handleTitleEditSave(chart.id)}
                          autoFocus
                          style={{ 
                            backgroundColor: '#3a3a3a', 
                            color: 'white', 
                            border: '1px solid #555',
                            fontSize: '14px'
                          }}
                        />
                        <button
                          className="btn btn-success btn-sm ms-2"
                          onClick={() => handleTitleEditSave(chart.id)}
                          title="Сохранить"
                        >
                          <i className="bi bi-check"></i>
                        </button>
                        <button
                          className="btn btn-secondary btn-sm ms-1"
                          onClick={handleTitleEditCancel}
                          title="Отменить"
                        >
                          <i className="bi bi-x"></i>
                        </button>
                      </div>
                    ) : (
                      <span 
                        className="chart-title flex-grow-1"
                        onDoubleClick={() => handleTitleEditStart(chart)}
                        title="Двойной клик для редактирования названия"
                        style={{ cursor: 'pointer' }}
                      >
                        <i className="bi bi-graph-up me-2"></i>
                        {displayTitle} - {chart.type === 'linear' ? 'Линейный' : 'Векторный'}
                      </span>
                    )}
                    
                    <div className="chart-actions">
                      {!isEditing && (
                        <>
                          <button
                            className="btn btn-outline-secondary btn-sm me-2"
                            onClick={() => handleTitleEditStart(chart)}
                            title="Редактировать название"
                          >
                            <i className="bi bi-pencil"></i>
                          </button>
                          <button
                            className={`btn btn-sm me-2 ${isUpdating ? 'btn-warning' : 'btn-primary'}`}
                            onClick={() => onUpdateToggle(chart.id)}
                            title={isUpdating ? "Остановить обновление" : "Запустить обновление"}
                          >
                            <i className={`bi ${isUpdating ? 'bi-pause-fill' : 'bi-play-fill'}`}></i>
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => onRemoveChart(chart.id)}
                            title="Удалить график"
                          >
                            <i className="bi bi-x-lg"></i>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="chart-content">
                    {isUpdating && (
                      <div className="updating-overlay">
                        <div className="spinner-border spinner-border-sm text-warning" role="status">
                          <span className="visually-hidden">Обновление...</span>
                        </div>
                      </div>
                    )}
                    <Chart 
                      key={`chart-content-${chart.id}-${index}`}
                      data={chart.data || []}
                      type={chart.type}
                      isUpdating={isUpdating}
                      colors={{
                        backgroundColor: '#2a2a2a',
                        textColor: 'white',
                        lineColor: chart.color || '#133592',
                        areaTopColor: '#2a4a9c',
                        areaBottomColor: '#1a2a5c'
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ChartsContainer;