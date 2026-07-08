import React, { useState, useCallback, useEffect, useRef } from 'react';
import { 
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  ReactFlowProvider,
  useReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './Graph.css';
import Sidebar from './components/Sidebar';
import { useTheme } from './components/ThemeContext';
import LinearChartNode from './nodes/LinearChartNode';
import RadialChartNode from './nodes/RadialChartNode';
import NotepadNode from './nodes/NotepadNode';
import IndicatorNode from './nodes/IndicatorNode';
import { serializeCanvas, downloadConfig, deserializeCanvas } from './services/canvasConfig';
import { reloadLinesData } from './services/chartData';

// Вспомогательные узлы
const DataSourceNode = ({ data, selected, id }) => {
  const [nodeSize, setNodeSize] = useState({ width: data.width || 300, height: data.height || 200 });
  const { setNodes } = useReactFlow();

  useEffect(() => {
    if (data.width && data.height) {
      setNodeSize({ width: data.width, height: data.height });
    }
  }, [data.width, data.height]);

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div 
      className="data-source-node"
      style={{ width: nodeSize.width, height: nodeSize.height, minWidth: 200, minHeight: 150 }}
      onContextMenu={handleContextMenu}
    >
      <div className='data-source-header'>
        <h6>Доп. Блок 1</h6>
        <input style={{ width: nodeSize.width, height: nodeSize.height, minWidth: 200, minHeight: 80 }} />
      </div>
    </div>
  );
};

const ProcessorNode = ({ data, selected, id }) => {
  const [isActive, setIsActive] = useState(true);
  const [processedCount, setProcessedCount] = useState(0);
  const [nodeSize, setNodeSize] = useState({ width: data.width || 300, height: data.height || 200 });
  const { setNodes } = useReactFlow();

  useEffect(() => {
    if (data.width && data.height) {
      setNodeSize({ width: data.width, height: data.height });
    }
  }, [data.width, data.height]);

  const handleToggle = useCallback(() => setIsActive(!isActive), [isActive]);
  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div 
      className="processor-node"
      style={{ width: nodeSize.width, height: nodeSize.height, minWidth: 200, minHeight: 150 }}
      onContextMenu={handleContextMenu}
    >
      <div className="processor-header">
        <div className="processor-icon"><i className={`bi ${data.icon || 'bi-gear'}`}></i></div>
        <div className="processor-info">
          <h6>{data.label || 'Обработчик'}</h6>
          <small className="text-muted">{data.description || 'Обрабатывает данные'}</small>
        </div>
        <div className="processor-toggle">
          <div className="form-check form-switch">
            <input className="form-check-input" type="checkbox" checked={isActive} onChange={handleToggle} />
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

// Максимальное число шагов перемещения, хранимых в истории отмены
const MAX_HISTORY = 50;

// Регистрация типов узлов
const nodeTypes = {
  linearChartNode: LinearChartNode,
  radialChartNode: RadialChartNode,
  dataSourceNode: DataSourceNode,
  processorNode: ProcessorNode,
  notepadNode: NotepadNode,
  indicatorNode: IndicatorNode
};

const Graph = () => {
  const { isDark } = useTheme();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [nodeCounter, setNodeCounter] = useState(1);

  // Глобальная функция для обновления данных узла
  useEffect(() => {
    window.updateNodeData = (nodeId, payload) => {
      setNodes((nds) => 
        nds.map((node) => {
          if (node.id === nodeId && (node.type === 'linearChartNode' || node.type === 'radialChartNode')) {
            return {
              ...node,
              data: {
                ...node.data,
                lines: payload.lines || [],
                updateTimestamp: payload.timestamp || Date.now()
              }
            };
          }
          return node;
        })
      );
    };
    
    return () => { delete window.updateNodeData; };
  }, [setNodes]);

  // Точечное обновление data узла-блокнота (стиль текста из сайдбара).
  useEffect(() => {
    window.updateNotepadData = (nodeId, patch) => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId && node.type === 'notepadNode'
            ? { ...node, data: { ...node.data, ...patch } }
            : node
        )
      );
    };

    return () => { delete window.updateNotepadData; };
  }, [setNodes]);

  // Точечное обновление data узла-индикатора (источник и состояния из сайдбара).
  useEffect(() => {
    window.updateIndicatorData = (nodeId, patch) => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId && node.type === 'indicatorNode'
            ? { ...node, data: { ...node.data, ...patch } }
            : node
        )
      );
    };

    return () => { delete window.updateIndicatorData; };
  }, [setNodes]);

  // --- История перемещений узлов: откат по Ctrl+Z, повтор по Ctrl+Shift+Z / Ctrl+Y ---

  // Зеркало актуального состояния узлов для чтения внутри обработчиков
  const nodesRef = useRef(nodes);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);

  const undoStack = useRef([]); // снимки позиций до перемещения
  const redoStack = useRef([]); // снимки для повтора отменённого перемещения
  const dragStartSnapshot = useRef(null);

  // Снимок позиций всех узлов: [{ id, position }]
  const snapshotPositions = (nds) =>
    nds.map((n) => ({ id: n.id, position: { ...n.position } }));

  // Применяем сохранённые позиции к текущим узлам (сопоставление по id)
  const applyPositions = useCallback((snapshot) => {
    setNodes((nds) =>
      nds.map((n) => {
        const saved = snapshot.find((s) => s.id === n.id);
        return saved ? { ...n, position: { ...saved.position } } : n;
      })
    );
  }, [setNodes]);

  // Запоминаем позиции в момент начала перетаскивания
  const onNodeDragStart = useCallback(() => {
    dragStartSnapshot.current = snapshotPositions(nodesRef.current);
  }, []);

  // По окончании перетаскивания фиксируем шаг в истории (если что-то реально сдвинулось)
  const onNodeDragStop = useCallback(() => {
    const before = dragStartSnapshot.current;
    dragStartSnapshot.current = null;
    if (!before) return;

    const after = nodesRef.current;
    const moved = before.some((b) => {
      const node = after.find((n) => n.id === b.id);
      return node && (node.position.x !== b.position.x || node.position.y !== b.position.y);
    });
    if (!moved) return;

    undoStack.current.push(before);
    if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
    redoStack.current = []; // новое действие сбрасывает цепочку повтора
  }, []);

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const prev = undoStack.current.pop();
    redoStack.current.push(snapshotPositions(nodesRef.current));
    applyPositions(prev);
  }, [applyPositions]);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const next = redoStack.current.pop();
    undoStack.current.push(snapshotPositions(nodesRef.current));
    applyPositions(next);
  }, [applyPositions]);

  // Глобальный обработчик горячих клавиш отмены/повтора
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Не мешаем стандартному Ctrl+Z в полях ввода (переименование графиков и т.п.)
      const el = e.target;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) {
        return;
      }
      if (!(e.ctrlKey || e.metaKey)) return;

      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const onConnect = useCallback((params) => {
    setEdges((eds) => addEdge({ ...params, id: `edge-${Date.now()}`, animated: true, style: { stroke: '#666', strokeWidth: 2 } }, eds));
  }, [setEdges]);

  const onNodeClick = useCallback((event, node) => setSelectedNode(node), []);

  const addLinearChartNode = useCallback(() => {
    const newNodeId = `${nodeCounter}`;
    setNodes((nds) => [...nds, {
      id: newNodeId,
      type: 'linearChartNode',
      dragHandle: '.chart-node-header',
      position: { x: Math.random() * 500 + 100, y: Math.random() * 300 + 50 },
      data: { label: `Линейный график ${nodeCounter}`, width: 1200, height: 600 } 
    }]);
    setNodeCounter((prev) => prev + 1);
  }, [nodeCounter, setNodes]);

  const addRadialChartNode = useCallback(() => {
    const newNodeId = `${nodeCounter}`;
    setNodes((nds) => [...nds, {
      id: newNodeId,
      type: 'radialChartNode',
      dragHandle: '.chart-node-header',
      position: { x: Math.random() * 500 + 100, y: Math.random() * 300 + 50 },
      data: { label: `Радиальный график ${nodeCounter}`, width: 800, height: 800 }
    }]);
    setNodeCounter((prev) => prev + 1);
  }, [nodeCounter, setNodes]);

  const addNotepadNode = useCallback(() => {
    const newNodeId = `${nodeCounter}`;
    setNodes((nds) => [...nds, {
      id: newNodeId,
      type: 'notepadNode',
      dragHandle: '.notepad-node-header',
      position: { x: Math.random() * 500 + 100, y: Math.random() * 300 + 50 },
      data: { label: `Блокнот ${nodeCounter}`, text: '', width: 360, height: 280 }
    }]);
    setNodeCounter((prev) => prev + 1);
  }, [nodeCounter, setNodes]);

  const addIndicatorNode = useCallback(() => {
    const newNodeId = `${nodeCounter}`;
    setNodes((nds) => [...nds, {
      id: newNodeId,
      type: 'indicatorNode',
      dragHandle: '.chart-node-header',
      position: { x: Math.random() * 500 + 100, y: Math.random() * 300 + 50 },
      data: {
        label: `Индикатор ${nodeCounter}`,
        width: 400,
        height: 240,
        collapsed: false,
        table: '',
        columns: [],
        // два состояния по умолчанию: 0 → красный, 1 → зелёный
        states: [
          { value: '0', color: '#e74c3c', label: '' },
          { value: '1', color: '#2ecc71', label: '' }
        ]
      }
    }]);
    setNodeCounter((prev) => prev + 1);
  }, [nodeCounter, setNodes]);

  const deleteSelectedNode = useCallback(() => {
    if (selectedNode) {
      setNodes((nds) => nds.filter((node) => node.id !== selectedNode.id));
      setEdges((eds) => eds.filter((edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id));
      setSelectedNode(null);
    }
  }, [selectedNode, setNodes, setEdges]);

  const resetGraph = useCallback(() => {
    if (window.confirm('Вы уверены, что хотите сбросить граф?')) {
      setNodes([]);
      setEdges([]);
      setSelectedNode(null);
      setNodeCounter(1);
      undoStack.current = [];
      redoStack.current = [];
    }
  }, [setNodes, setEdges]);

  const getGraphInfo = useCallback(() => ({
    nodes: nodes.length,
    edges: edges.length,
    charts: nodes.filter(n => n.type === 'linearChartNode').length,
    radialCharts: nodes.filter(n => n.type === 'radialChartNode').length,
    sources: nodes.filter(n => n.type === 'dataSourceNode').length,
    processors: nodes.filter(n => n.type === 'processorNode').length,
    notes: nodes.filter(n => n.type === 'notepadNode').length
  }), [nodes, edges]);

  // Экспорт текущего полотна в .json-файл (только настройки, без точек данных).
  const handleExportCanvas = useCallback(() => {
    if (nodes.length === 0) {
      window.alert('Полотно пустое — нечего сохранять');
      return;
    }
    downloadConfig(serializeCanvas(nodes, edges, nodeCounter));
  }, [nodes, edges, nodeCounter]);

  // Импорт конфигурации: восстанавливаем узлы/связи, затем дозагружаем точки из БД.
  const handleImportConfig = useCallback(async (config) => {
    if (!window.confirm('Заменить текущее полотно загруженной конфигурацией?')) return;

    const { nodes: importedNodes, edges: importedEdges, nodeCounter: importedCounter } =
      deserializeCanvas(config);

    setNodes(importedNodes);
    setEdges(importedEdges);
    setSelectedNode(null);
    setNodeCounter(importedCounter);
    undoStack.current = [];
    redoStack.current = [];

    // Конфиг сохраняется без данных — подгружаем точки заново тем же путём,
    // что и кнопка «Применить параметры» (через window.updateNodeData).
    const chartNodes = importedNodes.filter(
      (n) => n.type === 'linearChartNode' || n.type === 'radialChartNode'
    );
    for (const node of chartNodes) {
      if (!node.data?.lines?.length) continue;
      try {
        const linesWithData = await reloadLinesData(node);
        if (window.updateNodeData) {
          window.updateNodeData(node.id, { lines: linesWithData, timestamp: Date.now() });
        }
      } catch (err) {
        console.error(`Не удалось загрузить данные для узла ${node.id}:`, err);
      }
    }
  }, [setNodes, setEdges, setNodeCounter]);

  return (
    <div className="graph-container">
      <Sidebar
        width={300}
        onAddChartNode={addLinearChartNode}
        onAddRadialChartNode={addRadialChartNode}
        onAddNotepad={addNotepadNode}
        onAddIndicator={addIndicatorNode}
        onDeleteSelectedNode={deleteSelectedNode}
        onResetGraph={resetGraph}
        onExportCanvas={handleExportCanvas}
        onImportConfig={handleImportConfig}
        selectedNode={selectedNode}
        graphInfo={getGraphInfo()}
      />
      
      <div className="reactflow-wrapper">
        <ReactFlow
          colorMode={isDark ? 'dark' : 'light'}
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onNodeDragStart={onNodeDragStart}
          onNodeDragStop={onNodeDragStop}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.1}
          maxZoom={2}
          nodeOrigin={[0, 0]}
        >
          <Controls />
          <Background variant="dots" gap={12} size={1.3} />
        </ReactFlow>
      </div>
    </div>
  );
};

const GraphWrapper = () => (
  <ReactFlowProvider>
    <Graph />
  </ReactFlowProvider>
);

export default GraphWrapper;