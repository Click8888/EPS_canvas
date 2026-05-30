import React, { useState, useCallback, useEffect } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  ReactFlowProvider,
  Panel
} from 'reactflow';
import 'reactflow/dist/style.css';
import './Graph.css';
import Sidebar from './components/Sidebar';

// Импортируем ChartCustom компонент
const ChartCustom = React.lazy(() => import('./components/ChartCustom'));

// Кастомный узел для графика
const ChartNode = ({ data, isConnectable }) => {
  const [chartData, setChartData] = useState([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [chartSeries, setChartSeries] = useState([]);

  // Инициализация данных графика
  useEffect(() => {
    if (data.initialData) {
      setChartData(data.initialData);
    }

    if (data.series) {
      setChartSeries(data.series);
    }
  }, [data.initialData, data.series]);

  // Функция для добавления новых данных
  const addDataPoint = useCallback((newPoint) => {
    setChartData(prev => [...prev, newPoint]);
  }, []);

  // Функция для добавления новой серии
  const addSeries = useCallback((newSeries) => {
    setChartSeries(prev => [...prev, newSeries]);
  }, []);

  // Функция для обновления данных
  const updateChart = useCallback((newData) => {
    setIsUpdating(true);
    setChartData(newData);
    
    // Имитация задержки обновления
    setTimeout(() => setIsUpdating(false), 500);
  }, []);

  // Функция для очистки данных
  const clearChart = useCallback(() => {
    setChartData([]);
    setChartSeries([]);
  }, []);

  // Конфигурация графика
  const chartColors = {
    backgroundColor: '#1e1e1e',
    textColor: '#ffffff',
    lineColor: data.lineColor || '#4dabf7',
    gridColor: '#444'
  };

  // Обработчик переключения серии
  const handleSeriesToggle = useCallback((seriesId, isVisible) => {
    console.log(`Series ${seriesId} is now ${isVisible ? 'visible' : 'hidden'}`);
  }, []);

  return (
    <div className="chart-node">
      <div className="chart-node-header">
        <div className="chart-node-title">
          <i className="bi bi-bar-chart"></i>
          <span>{data.label || 'График'}</span>
        </div>
        <div className="chart-node-actions">
          <button 
            className="btn btn-sm btn-outline-secondary"
            onClick={() => clearChart()}
            title="Очистить данные"
          >
            <i className="bi bi-trash"></i>
          </button>
        </div>
      </div>
      
      <div className="chart-node-content">
        <React.Suspense fallback={<div style={{ color: '#fff', padding: '20px' }}>Загрузка графика...</div>}>
          <ChartCustom
            data={chartData}
            series={chartSeries}
            colors={chartColors}
            type={data.chartType || 'linear'}
            isUpdating={isUpdating}
            onSeriesToggle={handleSeriesToggle}
            chartId={data.id || 'chart-1'}
            realTime={data.realTime || false}
            dataType="current"
          />
        </React.Suspense>
      </div>
      
      <div className="chart-node-footer">
        <small className="text-muted">
          Точки: {chartData.length} | Серии: {chartSeries.length}
        </small>
      </div>
    </div>
  );
};

// Кастомный узел для источника данных
const DataSourceNode = ({ data, isConnectable }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [dataCount, setDataCount] = useState(1000);
  const [intervalId, setIntervalId] = useState(null);

  // Функция для генерации случайных данных
  const generateRandomData = useCallback((count = 100) => {
    const newData = [];
    const now = new Date();
    const baseTime = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    
    for (let i = 0; i < count; i++) {
      const timeOffset = i * 0.1; // 0.1 секунды между точками
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

  // Функция для генерации синусоидальных данных
  const generateSineData = useCallback((count = 100) => {
    const newData = [];
    const now = new Date();
    const baseTime = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    
    for (let i = 0; i < count; i++) {
      const timeOffset = i * 0.05; // 0.05 секунды между точками
      const value = 100 + 50 * Math.sin(i * 0.1);
      const overload = value > 140;
      
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
    
    // Если это источник данных, начинаем генерацию
    if (data.type === 'source') {
      // Отправляем начальные данные
      if (data.onDataGenerate) {
        const initialData = generateRandomData(dataCount);
        data.onDataGenerate(initialData);
      }
      
      // Начинаем потоковую генерацию
      const id = setInterval(() => {
        if (data.onDataGenerate) {
          const newData = generateRandomData(10); // 10 новых точек каждую секунду
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

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [intervalId]);

  return (
    <div className="data-source-node">
      <div className="data-source-header">
        <div className="data-source-icon">
          <i className={`bi ${data.icon || 'bi-database'}`}></i>
        </div>
        <div className="data-source-info">
          <h6>{data.label || 'Источник данных'}</h6>
          <small className="text-muted">{data.description || 'Генерирует данные'}</small>
        </div>
      </div>
      
      <div className="data-source-controls">
        {data.type === 'source' && (
          <>
            <div className="form-group mb-2">
              <label className="form-label" style={{ fontSize: '12px' }}>
                Количество данных: {dataCount}
              </label>
              <input
                type="range"
                className="form-range"
                min="100"
                max="10000"
                step="100"
                value={dataCount}
                onChange={(e) => setDataCount(parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
            
            <div className="btn-group btn-group-sm w-100" role="group">
              <button
                className={`btn ${isConnected ? 'btn-success' : 'btn-outline-success'}`}
                onClick={handleConnect}
                disabled={isConnected}
              >
                <i className="bi bi-play"></i> Старт
              </button>
              <button
                className={`btn ${!isConnected ? 'btn-danger' : 'btn-outline-danger'}`}
                onClick={handleDisconnect}
                disabled={!isConnected}
              >
                <i className="bi bi-stop"></i> Стоп
              </button>
            </div>
            
            <div className="mt-2">
              <small className="text-muted">
                Тип: {data.dataType || 'Случайные данные'}
              </small>
            </div>
          </>
        )}
        
        {data.type === 'filter' && (
          <div className="filter-controls">
            <div className="form-group mb-2">
              <label className="form-label" style={{ fontSize: '12px' }}>
                Минимальное значение
              </label>
              <input
                type="range"
                className="form-range"
                min="0"
                max="200"
                step="1"
                defaultValue="50"
                style={{ width: '100%' }}
              />
            </div>
            <div className="form-group mb-2">
              <label className="form-label" style={{ fontSize: '12px' }}>
                Максимальное значение
              </label>
              <input
                type="range"
                className="form-range"
                min="0"
                max="200"
                step="1"
                defaultValue="150"
                style={{ width: '100%' }}
              />
            </div>
          </div>
        )}
      </div>
      
      <div className="data-source-status">
        <span className={`badge ${isConnected ? 'bg-success' : 'bg-secondary'}`}>
          {isConnected ? 'Подключено' : 'Отключено'}
        </span>
      </div>
    </div>
  );
};

// Кастомный узел для обработки данных
const ProcessorNode = ({ data, isConnectable }) => {
  const [isActive, setIsActive] = useState(true);
  const [processedCount, setProcessedCount] = useState(0);

  const handleToggle = useCallback(() => {
    setIsActive(!isActive);
  }, [isActive]);

  return (
    <div className="processor-node">
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
    </div>
  );
};

// Зарегистрируем типы узлов
const nodeTypes = {
  chartNode: ChartNode,
  dataSourceNode: DataSourceNode,
  processorNode: ProcessorNode
};

// Начальные узлы
const initialNodes = [
  {
    id: '1',
    type: 'dataSourceNode',
    position: { x: 50, y: 100 },
    data: {
      label: 'Источник данных 1',
      description: 'Генерирует случайные данные',
      type: 'source',
      icon: 'bi-database',
      dataType: 'Случайные данные',
      onDataGenerate: (data) => console.log('Data generated:', data)
    }
  },
  {
    id: '2',
    type: 'processorNode',
    position: { x: 300, y: 100 },
    data: {
      label: 'Фильтр данных',
      description: 'Фильтрует данные по значению',
      icon: 'bi-funnel',
      parameters: {
        minValue: 50,
        maxValue: 150,
        smoothing: 'enabled'
      }
    }
  },
  {
    id: '3',
    type: 'chartNode',
    position: { x: 550, y: 100 },
    data: {
      label: 'График 1',
      chartType: 'linear',
      lineColor: '#4dabf7',
      realTime: true,
      initialData: [],
      series: []
    }
  },
  {
    id: '4',
    type: 'dataSourceNode',
    position: { x: 50, y: 300 },
    data: {
      label: 'Источник данных 2',
      description: 'Генерирует синусоидальные данные',
      type: 'source',
      icon: 'bi-sine-wave',
      dataType: 'Синусоида',
      onDataGenerate: (data) => console.log('Sine data generated:', data)
    }
  },
  {
    id: '5',
    type: 'chartNode',
    position: { x: 550, y: 300 },
    data: {
      label: 'График 2',
      chartType: 'linear',
      lineColor: '#40c057',
      realTime: true,
      initialData: [],
      series: []
    }
  }
];

// Начальные соединения
const initialEdges = [
  {
    id: 'e1-2',
    source: '1',
    target: '2',
    animated: true,
    style: { stroke: '#4dabf7', strokeWidth: 2 }
  },
  {
    id: 'e2-3',
    source: '2',
    target: '3',
    animated: true,
    style: { stroke: '#4dabf7', strokeWidth: 2 }
  },
  {
    id: 'e4-3',
    source: '4',
    target: '3',
    animated: true,
    style: { stroke: '#40c057', strokeWidth: 2 }
  },
  {
    id: 'e4-5',
    source: '4',
    target: '5',
    animated: true,
    style: { stroke: '#40c057', strokeWidth: 2 }
  }
];

// Основной компонент графа
const Graph = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [rfInstance, setRfInstance] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [nodeCounter, setNodeCounter] = useState(6);

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
        label: `График ${nodeCounter - 5}`,
        chartType: 'linear',
        lineColor: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
        realTime: true,
        initialData: [],
        series: []
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
        label: `Источник ${nodeCounter - 5}`,
        description: 'Генерирует данные',
        type: 'source',
        icon: 'bi-database',
        dataType: 'Случайные данные',
        onDataGenerate: (data) => console.log(`Data from ${newNodeId}:`, data)
      }
    };
    
    setNodes((nds) => [...nds, newNode]);
    setNodeCounter((prev) => prev + 1);
  }, [nodeCounter, setNodes]);

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
        label: `Обработчик ${nodeCounter - 5}`,
        description: 'Обрабатывает данные',
        icon: 'bi-gear',
        parameters: {
          тип: 'стандартный',
          режим: 'авто'
        }
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

  // Сохранение графа
  const saveGraph = useCallback(() => {
    if (rfInstance) {
      const flow = rfInstance.toObject();
      localStorage.setItem('graph-flow', JSON.stringify(flow));
      alert('Граф сохранен в localStorage');
    }
  }, [rfInstance]);

  // Загрузка графа
  const loadGraph = useCallback(() => {
    const savedFlow = localStorage.getItem('graph-flow');
    if (savedFlow) {
      const flow = JSON.parse(savedFlow);
      
      // Восстанавливаем узлы с правильными типами
      const restoredNodes = flow.nodes.map(node => {
        if (node.type === 'dataSourceNode') {
          node.data = {
            ...node.data,
            onDataGenerate: () => console.log('Data generated from loaded node')
          };
        }
        return node;
      });
      
      setNodes(restoredNodes || []);
      setEdges(flow.edges || []);
    }
  }, [setNodes, setEdges]);

  // Экспорт графика в JSON
  const exportGraph = useCallback(() => {
    if (rfInstance) {
      const flow = rfInstance.toObject();
      const dataStr = JSON.stringify(flow, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `graph-${new Date().toISOString().slice(0, 10)}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    }
  }, [rfInstance]);

  // Сброс графа
  const resetGraph = useCallback(() => {
    if (window.confirm('Вы уверены, что хотите сбросить граф?')) {
      setNodes(initialNodes);
      setEdges(initialEdges);
      setSelectedNode(null);
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

  return (
    <div className="graph-container">
      {/* Sidebar */}
      <Sidebar
        width={300}
        onAddChartNode={addChartNode}
        onAddDataSourceNode={addDataSourceNode}
        onAddProcessorNode={addProcessorNode}
        onDeleteSelectedNode={deleteSelectedNode}
        onSaveGraph={saveGraph}
        onLoadGraph={loadGraph}
        onExportGraph={exportGraph}
        onResetGraph={resetGraph}
        selectedNode={selectedNode}
        graphInfo={graphInfo}
      />
      
      <div className="graph-content">
              
        <div className="reactflow-wrapper">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            onInit={setRfInstance}
            fitView
            attributionPosition="bottom-right"
          >
            <MiniMap 
              nodeStrokeColor="#4dabf7"
              nodeColor="#2a2a2a"
              maskColor="rgba(0, 0, 0, 0.5)"
              style={{ backgroundColor: '#1e1e1e' }}
            />
            <Controls />
            <Background variant="dots" gap={12} size={1} />
            
          </ReactFlow>
        </div>
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