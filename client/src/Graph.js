import React, { useState, useCallback, useEffect } from 'react';
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

// Вспомогательные узлы (DataSourceNode и ProcessorNode можно позже тоже вынести)
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

// Регистрация типов узлов
const nodeTypes = {
  linearChartNode: LinearChartNode,
  radialChartNode: RadialChartNode,
  dataSourceNode: DataSourceNode,
  processorNode: ProcessorNode
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
    }
  }, [setNodes, setEdges]);

  const getGraphInfo = useCallback(() => ({
    nodes: nodes.length,
    edges: edges.length,
    charts: nodes.filter(n => n.type === 'linearChartNode').length,
    radialCharts: nodes.filter(n => n.type === 'radialChartNode').length,
    sources: nodes.filter(n => n.type === 'dataSourceNode').length,
    processors: nodes.filter(n => n.type === 'processorNode').length
  }), [nodes, edges]);

  return (
    <div className="graph-container">
      <Sidebar
        width={300}
        onAddChartNode={addLinearChartNode}
        onAddRadialChartNode={addRadialChartNode}
        onDeleteSelectedNode={deleteSelectedNode}
        onResetGraph={resetGraph}
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