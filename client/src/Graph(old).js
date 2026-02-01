import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import Navbar from './components/Navbar';
import ChartsContainer from './components/ChartsContainer';
import SqlPanel from './components/SqlPanel';
import ChartTypeModal from './components/ChartTypeModal';

// Константы
const MAX_CHARTS = 6;
const API_BASE_URL = process.env.REACT_APP_API_URL;

function transformData(inputJson, xAxis = 'Measurement_time', yAxis = 'Current_value') {
  let transformedData = inputJson.map(item => ({
    time: item[xAxis] || item.Measurement_time || item.time,
    value: item[yAxis] || item.Current_value || item.Voltage_value || item.value  // ДОБАВЛЕНО Voltage_value
  }));
  
  // Фильтруем некорректные данные
  transformedData = transformedData.filter(item => 
    item.time !== undefined && item.value !== undefined
  );
  
  // Ограничиваем количество точек до 1500
  if (transformedData.length > 1500) {
    transformedData = transformedData.slice(-1500);
  }
  
  return transformedData;
}

function Graph() {
  const [charts, setCharts] = useState([]);
  const [selectedChartId, setSelectedChartId] = useState(null);
  const [draggedChart, setDraggedChart] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedChartType, setSelectedChartType] = useState('linear');
  const [UpdateInterval, setUpdateInterval] = useState(100);
  const [showSqlPanel, setShowSqlPanel] = useState(false);
  const [updatingCharts, setUpdatingCharts] = useState(new Set());
  const [editTitleValue, setEditTitleValue] = useState('');
  const [tablesMetadata, setTablesMetadata] = useState({});
  const [tableNames, setTableNames] = useState([]);
  const [columnsByTable, setColumnsByTable] = useState({});
  const [chartSeries, setChartSeries] = useState({});

  //ГЕНЕРАЦИЯ ДАННЫХ -НАЧАЛО
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('stopped');

// Функции для управления генерацией
const startDataGeneration = useCallback(async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/generation/start`, {
      method: 'POST'
    });
    
    if (response.ok) {
      setIsGenerating(true);
      setGenerationStatus('running');
    }
  } catch (error) {
    console.error("Ошибка запуска генерации:", error);
  }
}, []);

const stopDataGeneration = useCallback(async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/generation/stop`, {
      method: 'POST'
    });
    
    if (response.ok) {
      setIsGenerating(false);
      setGenerationStatus('stopped');
    }
  } catch (error) {
    console.error("Ошибка остановки генерации:", error);
  }
}, []);

// Эффект для проверки статуса при загрузке
useEffect(() => {
  const checkGenerationStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/generation/status`);
	
      if (response.ok) {
        const status = await response.json();
        setIsGenerating(status.isGenerating);
        setGenerationStatus(status.status);
      }
    } catch (error) {
      console.error("Ошибка проверки статуса генерации:", error);
    }
  };
  
  checkGenerationStatus();
}, []);
  //ГЕНЕРАЦИЯ ДАННЫХ - КОНЕЦ

  const normalizeId = (id) => {
    if (id === null || id === undefined || id === '') return null;
    return typeof id === 'string' ? parseInt(id, 10) : id;
  };



  // Функции работы с сериями
  const addSeriesToChart = (chartId, seriesConfig) => {
    const normalizedId = normalizeId(chartId);
    
    const newSeries = {
      ...seriesConfig,
      id: Date.now() + Math.random(),
      selectedTable: seriesConfig.selectedTable || '',
      data: [],
      lastUpdate: Date.now()
    };

    setChartSeries(prev => {
      const currentSeries = prev[normalizedId] || [];
      return {
        ...prev,
        [normalizedId]: [...currentSeries, newSeries]
      };
    });
  };

  const removeSeriesFromChart = (chartId, seriesId) => {
    const normalizedId = normalizeId(chartId);
    
    setChartSeries(prev => {
      const currentSeries = prev[normalizedId] || [];
      const filteredSeries = currentSeries.filter(s => s.id !== seriesId);
      
      if (filteredSeries.length === 0) {
        const newState = { ...prev };
        delete newState[normalizedId];
        return newState;
      }
      
      return {
        ...prev,
        [normalizedId]: filteredSeries
      };
    });
  };

  const updateSeriesInChart = (chartId, seriesId, updates) => {
    const normalizedId = normalizeId(chartId);
    
    setChartSeries(prev => {
      const currentSeries = prev[normalizedId] || [];
      const updatedSeries = currentSeries.map(s =>
        s.id === seriesId ? { 
          ...s, 
          ...updates,
          lastUpdate: Date.now()
        } : s
      );
      
      return {
        ...prev,
        [normalizedId]: updatedSeries
      };
    });
  };

  //МЕТАДАННЫЕ
  const parseMetadata = useCallback((metadata) => {
    if (!metadata || !metadata.tables) return;
    
    const tables = metadata.tables.map(table => table.table_name);
    setTableNames(tables);
    
    const columnsMap = {};
    metadata.tables.forEach(table => {
      columnsMap[table.table_name] = table.columns.map(col => col.column_name);
    });
    setColumnsByTable(columnsMap);
    
    setTablesMetadata(metadata);
  }, []);

  // Парсинг названий таблицы, столбцов
  useEffect(() => {
    const loadNamesData = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/metadata`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const metadata = await response.json();
        parseMetadata(metadata.metadata || metadata);
      } catch (error) {
        console.error("Ошибка при загрузке названий:", error);
      }
    };
    
    loadNamesData();
  }, [parseMetadata]);

  // Функция для получения новых данных
  const fetchNewData = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/getparams`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const transformedData = transformData(data.databases);
      return transformedData;
    } catch (error) {
      console.error("Ошибка при загрузке данных:", error);
      return [];
    }
  }, []);

  // Добавьте эту функцию
  const handleChartTitleChange = useCallback((chartId, newTitle) => {
    const normalizedId = normalizeId(chartId);
    setCharts(prev => prev.map(chart => 
      chart.id === normalizedId 
        ? { ...chart, title: newTitle }
        : chart
    ));
  }, []);

  // Обработчик SQL запросов
const handleExecuteQuery = useCallback(async (query, chartId = null, seriesId = null) => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/execute-query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ Sql: query })
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const result = await response.json();
        const data = result.data || result;
 
        if (data && Array.isArray(data)) {
            const normalizedChartId = normalizeId(chartId);
		
            if (normalizedChartId) {
                let transformedData;
                
                // Определяем оси для трансформации
                let xAxis, yAxis;
                
                if (seriesId) {
                    // Для дополнительных серий используем настройки серии
                    const seriesConfig = chartSeries[normalizedChartId]?.find(s => s.id === seriesId);
                    xAxis = seriesConfig?.xAxis;
                    yAxis = seriesConfig?.yAxis;
                } else {
                    // Для основной серии используем настройки графика
                    const chart = charts.find(c => c.id === normalizedChartId);
                    xAxis = chart?.xAxis;
                    yAxis = chart?.yAxis;
                }
                
                transformedData = transformData(data, xAxis, yAxis);
                if (transformedData && transformedData.length > 0) {
                    if (transformedData.length > 1500) {
                        transformedData = transformedData.slice(-1500);
                    }
                    
                    if (seriesId) {
                        updateSeriesInChart(normalizedChartId, seriesId, { data: transformedData });
                    } else {
                        setCharts(prev => prev.map(chart => 
                            chart.id === normalizedChartId 
                                ? { ...chart, data: transformedData }
                                : chart
                        ));
                    }
                }
            }
        }
    } catch (error) {
        console.error("Ошибка при выполнении запроса:", error);
        throw error;
    }
}, [charts, chartSeries, setCharts]);

  // Функция для обновления данных конкретного графика
const updateChartData = useCallback(async (chartId) => {
    try {
        const chart = charts.find(c => c.id === chartId);
        if (!chart) return;

        const updatePromises = [];

        // Обновляем основную серию
        if (chart.selectedTable && chart.xAxis && chart.yAxis) {
            const mainQuery = `SELECT ${chart.xAxis}, ${chart.yAxis} FROM ${chart.selectedTable}`;
            updatePromises.push(handleExecuteQuery(mainQuery, chartId));
        }

        // Обновляем дополнительные серии
        const seriesForChart = chartSeries[chartId] || [];
        for (const series of seriesForChart) {
            if (series.selectedTable && series.xAxis && series.yAxis && series.enabled !== false) {
                const seriesQuery = `SELECT ${series.xAxis}, ${series.yAxis} FROM ${series.selectedTable}`;
                updatePromises.push(handleExecuteQuery(seriesQuery, chartId, series.id));
            }
        }

        await Promise.all(updatePromises);
        
    } catch (error) {
        console.error(`Ошибка при обновлении графика ${chartId}:`, error);
    }
}, [charts, chartSeries, handleExecuteQuery]);

  // Обработчик переключения обновления графика
  const handleChartUpdateToggle = useCallback(async (chartId) => {
    const normalizedChartId = normalizeId(chartId);
    
    const isCurrentlyUpdating = updatingCharts.has(normalizedChartId);
    
    if (isCurrentlyUpdating) {
      setUpdatingCharts(prev => {
        const newSet = new Set(prev);
        newSet.delete(normalizedChartId);
        return newSet;
      });
    } else {
      setUpdatingCharts(prev => new Set(prev).add(normalizedChartId));
      await updateChartData(normalizedChartId);
    }
  }, [updatingCharts, updateChartData]);

  // Эффект для непрерывного обновления графиков
  useEffect(() => {
    if (updatingCharts.size === 0) return;

    const intervals = {};

    charts.forEach(chart => {
      if (updatingCharts.has(chart.id)) {
        const interval = chart.refreshInterval || 1000;
        
        if (!intervals[chart.id]) {
          intervals[chart.id] = setInterval(async () => {
            await updateChartData(chart.id);
          }, interval);
        }
      }
    });

    return () => {
      Object.values(intervals).forEach(intervalId => clearInterval(intervalId));
    };
  }, [updatingCharts, charts, updateChartData]);

  // Добавление нового графика
  const addChartWithType = useCallback(() => {
    const newChart = {
      id: Date.now(),
      data: [],
      type: selectedChartType,
      orderIndex: charts.length + 1,
      title: `График #${charts.length + 1}`,
      selectedTable: '',
      xAxis: '',
      yAxis: '',
      color: '#133592',
      refreshInterval: 1000,
      showGrid: true
    };
    setCharts(prev => [...prev, newChart]);
    setShowModal(false);
  }, [selectedChartType, charts.length]);

  const openModal = useCallback(() => {
    if (charts.length >= MAX_CHARTS) {

      return;
    }
    setShowModal(true);
  }, [charts.length]);

  const closeModal = useCallback(() => {
    setShowModal(false);
  }, []);

  const resetChartSettings = useCallback((chartId) => {
    const normalizedId = normalizeId(chartId);
    
    setCharts(prev => prev.map(chart => 
      chart.id === normalizedId 
        ? {
            ...chart,
            selectedTable: '',
            xAxis: '',
            yAxis: '',
            color: '#133592',
            refreshInterval: 1000,
            showGrid: true,
            data: []
          }
        : chart
    ));
  }, []);

  const removeChart = useCallback((chartId) => {
    const normalizedId = normalizeId(chartId);
    
    resetChartSettings(normalizedId);
    
    setUpdatingCharts(prev => {
      const newSet = new Set(prev);
      newSet.delete(normalizedId);
      return newSet;
    });
    
    setCharts(prev => {
      const filteredCharts = prev.filter(chart => chart.id !== normalizedId);
      return filteredCharts.map((chart, index) => ({
        ...chart,
        orderIndex: index + 1
      }));
    });
    
    if (normalizeId(selectedChartId) === normalizedId) {
      setSelectedChartId(null);
    }
  }, [selectedChartId, resetChartSettings]);

  // Drag & Drop функции
  const handleDragStart = useCallback((e, chartId) => {
    e.dataTransfer.setData('text/plain', chartId.toString());
    setDraggedChart(chartId);
    e.target.classList.add('dragging');
  }, []);

  const handleDragEnd = useCallback((e) => {
    setDraggedChart(null);
    e.target.classList.remove('dragging');
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e, targetChartId) => {
    e.preventDefault();
    const draggedChartId = e.dataTransfer.getData('text/plain');
    const normalizedDraggedId = normalizeId(draggedChartId);
    const normalizedTargetId = normalizeId(targetChartId);
    
    if (normalizedDraggedId && normalizedDraggedId !== normalizedTargetId) {
      setCharts(prev => {
        const newCharts = [...prev];
        const draggedIndex = newCharts.findIndex(chart => chart.id === normalizedDraggedId);
        const targetIndex = newCharts.findIndex(chart => chart.id === normalizedTargetId);
        
        if (draggedIndex !== -1 && targetIndex !== -1) {
          [newCharts[draggedIndex], newCharts[targetIndex]] = 
          [newCharts[targetIndex], newCharts[draggedIndex]];
          
          newCharts.forEach((chart, index) => {
            chart.orderIndex = index + 1;
          });
        }
        
        return newCharts;
      });
    }
  }, []);

  return (
      <div className='overflow-hidden'>
      <ChartTypeModal
        show={showModal}
        onClose={closeModal}
        selectedChartType={selectedChartType}
        onChartTypeChange={setSelectedChartType}
        onAddChart={addChartWithType}
      />

      <div className='charts-area-container flex-grow-1 mt-2'>
        <ChartsContainer
          charts={charts}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          draggedChart={draggedChart}
          onRemoveChart={removeChart}
          onUpdateToggle={handleChartUpdateToggle}
          updatingCharts={updatingCharts}
          onChartTitleChange={handleChartTitleChange}
          editTitleValue={editTitleValue}
          setEditTitleValue={setEditTitleValue}
          chartSeries={chartSeries}
        />
      </div>

      <SqlPanel
        show={showSqlPanel}
        onClose={() => setShowSqlPanel(false)}
        onExecuteQuery={handleExecuteQuery}
        charts={charts}
        selectedChartId={selectedChartId}
        onSelectChart={(id) => setSelectedChartId(normalizeId(id))}
        onUpdateToggle={handleChartUpdateToggle} 
        updatingCharts={updatingCharts} 
        onRemoveChart={removeChart} 
        editTitleValue={editTitleValue}
        tableNames={tableNames}
        columnsByTable={columnsByTable}
        setCharts={setCharts}
        chartSeries={chartSeries}
        onAddSeries={addSeriesToChart}
        onRemoveSeries={removeSeriesFromChart}
        onUpdateSeries={updateSeriesInChart}
        onChartTitleChange={handleChartTitleChange}
        //ГЕНЕРАЦИЯ
        isGenerating={isGenerating}
        onStartGeneration={startDataGeneration}
        onStopGeneration={stopDataGeneration}
        generationStatus={generationStatus}
      />
      
      <div className="charts-bottom-panel d-flex justify-content-center gap-2 p-2">
        <button 
          onClick={openModal} 
          className='btn btn-success add-chart-btn'
          disabled={charts.length >= MAX_CHARTS}
          title="Добавить новый график"
        >
          <i className="bi bi-plus-lg"></i>
        </button>
        
        <button 
          onClick={() => setShowSqlPanel(!showSqlPanel)}
          className={`btn sql-btn ${showSqlPanel ? 'btn-warning' : 'btn-primary'}`}
          title={showSqlPanel ? "Закрыть SQL редактор" : "Открыть настройки параметров"}
        >
          <i className="bi bi-sliders"></i>
        </button>
        
      </div>
      </div>
  );
}

export default Graph;