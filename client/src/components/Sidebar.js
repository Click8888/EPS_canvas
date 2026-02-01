import React, { useState, useRef, useEffect, useCallback } from 'react';
import './Sidebar.css';

const Sidebar = ({ 
  width = 300, 
  minWidth = 20,
  maxWidth = 600,
  onAddChartNode,
  onAddDataSourceNode,
  onAddProcessorNode,
  onDeleteSelectedNode,
  onResetGraph,
  selectedNode,
  graphInfo
}) => {
  const [sidebarWidth, setSidebarWidth] = useState(width);
  const [isResizing, setIsResizing] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const sidebarRef = useRef(null);
  const resizeTimeoutRef = useRef(null);
  const lastUpdateTimeRef = useRef(Date.now());
  const collapseThreshold = 80;

  // Функция для безопасного изменения ширины с задержкой
  const safeSetWidth = useCallback((newWidth) => {
    // Отменяем предыдущие таймауты
    if (resizeTimeoutRef.current) {
      cancelAnimationFrame(resizeTimeoutRef.current);
    }
    
    // Используем requestAnimationFrame для синхронизации с браузером
    resizeTimeoutRef.current = requestAnimationFrame(() => {
      setSidebarWidth(Math.max(minWidth, Math.min(maxWidth, newWidth)));
      
      // Добавляем небольшую задержку для стабилизации
      setTimeout(() => {
        if (newWidth <= collapseThreshold && !isCollapsed) {
          setIsCollapsed(true);
        } else if (newWidth > collapseThreshold && isCollapsed) {
          setIsCollapsed(false);
        }
      }, 50);
    });
  }, [isCollapsed, collapseThreshold, minWidth, maxWidth]);

  // Поэтапное сворачивание с анимацией
  const toggleSidebar = useCallback(() => {
    if (isAnimating || isResizing) return;
    
    setIsAnimating(true);
    
    if (isCollapsed) {
      // Разворачиваем поэтапно
      const targetWidth = width;
      const steps = [minWidth + 50, minWidth + 150, targetWidth];
      
      steps.forEach((stepWidth, index) => {
        setTimeout(() => {
          safeSetWidth(stepWidth);
          if (index === steps.length - 1) {
            setIsCollapsed(false);
            setIsAnimating(false);
          }
        }, index * 100);
      });
    } else {
      // Сворачиваем поэтапно
      const steps = [width * 0.7, width * 0.4, minWidth];
      
      steps.forEach((stepWidth, index) => {
        setTimeout(() => {
          safeSetWidth(stepWidth);
          if (index === steps.length - 1) {
            setIsCollapsed(true);
            setIsAnimating(false);
          }
        }, index * 80);
      });
    }
  }, [isCollapsed, isAnimating, width, minWidth, safeSetWidth, isResizing]);

  // Обработчик клика на весь сайдбар в свернутом состоянии
  const handleSidebarClick = useCallback((e) => {
    // Если сайдбар свернут и клик не на ресайзере - открываем
    if (isCollapsed && !e.target.closest('.sidebar-resizer')) {
      toggleSidebar();
    }
  }, [isCollapsed, toggleSidebar]);

  // Оптимизированный обработчик ресайза
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsResizing(true);
    lastUpdateTimeRef.current = Date.now();
    
    
    const startX = e.clientX;
    const startWidth = isCollapsed ? minWidth : sidebarWidth;
    
    // Для свернутого состояния используем начальную позицию с учетом нового состояния
    const effectiveStartWidth = isCollapsed ? minWidth : sidebarWidth;
    
    // Добавляем класс для блокировки анимаций  
    if (sidebarRef.current) {
      sidebarRef.current.classList.add('resizing-active');
    }
    
    const handleMouseMove = (e) => {
      const currentTime = Date.now();
      const timeDiff = currentTime - lastUpdateTimeRef.current;
      
      // Ограничиваем частоту обновлений (не чаще чем раз в 16мс ~60fps)
      if (timeDiff < 16) return;
      
      lastUpdateTimeRef.current = currentTime;
      
      const diff = e.clientX - startX;
      let newWidth = Math.max(minWidth, Math.min(maxWidth, effectiveStartWidth + diff));
      
      // Если сайдбар был свернут, но мы уже начали тянуть,
      // гарантируем что он остается открытым
      if (newWidth > minWidth + 10 && isCollapsed) {
        setIsCollapsed(false);
      }
      
      // Используем requestAnimationFrame для синхронизации
      requestAnimationFrame(() => {
        if (sidebarRef.current) {
          sidebarRef.current.style.width = `${newWidth}px`;
          sidebarRef.current.style.setProperty('--sidebar-width', `${newWidth}px`);
          setSidebarWidth(newWidth); // Обновляем состояние сразу
        }
      });
    };
    
    const handleMouseUp = () => {
      // Фиксируем финальное состояние
      const finalWidth = parseInt(sidebarRef.current?.style.width || sidebarWidth);
      
      // Если ширина достаточно большая, считаем что сайдбар открыт
      if (finalWidth > collapseThreshold && isCollapsed) {
        setIsCollapsed(false);
      }
      
      // Восстанавливаем анимации с задержкой
      setTimeout(() => {
        if (sidebarRef.current) {
          sidebarRef.current.classList.remove('resizing-active');
        }
      }, 100);
      
      // Устанавливаем финальную ширину
      safeSetWidth(finalWidth);
      setIsResizing(false);
      setIsAnimating(false);
      
      // Удаляем обработчики
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    // Используем passive: false для предотвращения scroll
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
      // Во время ресайза и анимации отключаем transition
      sidebar.style.transition = 'none';
      sidebar.style.willChange = 'width';
    } else {
      // После ресайза включаем плавную анимацию
      setTimeout(() => {
        if (sidebar) {
          sidebar.style.transition = 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
          sidebar.style.willChange = 'auto';
        }
      }, 50);
    }
    
    // Устанавливаем ширину
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
              {/* Статистика графа */}
              {/* <div className="sidebar-section">
                <h6 className="sidebar-section-title">
                  <i className="bi bi-info-circle"></i>
                  Статистика графа
                </h6>
                <div className="graph-stats">
                  <div className="stat-row">
                    <span className="stat-label">Узлы:</span>
                    <span className="stat-value">{graphInfo?.nodes || 0}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Соединения:</span>
                    <span className="stat-value">{graphInfo?.edges || 0}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Графики:</span>
                    <span className="stat-value">{graphInfo?.charts || 0}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Источники:</span>
                    <span className="stat-value">{graphInfo?.sources || 0}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Обработчики:</span>
                    <span className="stat-value">{graphInfo?.processors || 0}</span>
                  </div>
                </div>
              </div> */}

              {/* Добавление узлов */}
              <div className="sidebar-section">
                <h6 className="sidebar-section-title">
                  <i className="bi bi-plus-circle"></i>
                  Добавить узел
                </h6>
                <div className="add-node-buttons">
                  <button 
                    className="btn btn-outline-primary btn-sm w-100 mb-2"
                    onClick={onAddChartNode}
                  >
                    <i className="bi bi-bar-chart"></i> График
                  </button>
                  <button 
                    className="btn btn-outline-success btn-sm w-100 mb-2"
                    onClick={onAddDataSourceNode}
                  >
                    <i className="bi bi-database"></i> Источник данных
                  </button>
                  <button 
                    className="btn btn-outline-warning btn-sm w-100"
                    onClick={onAddProcessorNode}
                  >
                    <i className="bi bi-gear"></i> Обработчик
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
                    Выбранный узел
                  </h6>
                  <div className="selected-node-info">
                    <div className="selected-node-header">
                      <span className="badge bg-primary">
                        {selectedNode.type === 'chartNode' && 'График'}
                        {selectedNode.type === 'dataSourceNode' && 'Источник'}
                        {selectedNode.type === 'processorNode' && 'Обработчик'}
                      </span>
                      <span className="ms-2">{selectedNode.data.label}</span>
                    </div>
                    <div className="selected-node-details">
                      <div className="detail-item">
                        <span className="detail-label">ID:</span>
                        <span className="detail-value">{selectedNode.id}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">X:</span>
                        <span className="detail-value">{Math.round(selectedNode.position.x)}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Y:</span>
                        <span className="detail-value">{Math.round(selectedNode.position.y)}</span>
                      </div>
                      {selectedNode.data.description && (
                        <div className="detail-item">
                          <span className="detail-label">Описание:</span>
                          <span className="detail-value">{selectedNode.data.description}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Быстрые действия */}
              {/* <div className="sidebar-section">
                <h6 className="sidebar-section-title">
                  <i className="bi bi-lightning"></i>
                  Быстрые действия
                </h6>
                <div className="quick-actions">
                  <button className="btn btn-sm btn-outline-secondary w-100 mb-1">
                    <i className="bi bi-arrows-angle-expand"></i> Подогнать все узлы
                  </button>
                  <button className="btn btn-sm btn-outline-secondary w-100 mb-1">
                    <i className="bi bi-grid"></i> Выровнять сетку
                  </button>
                  <button className="btn btn-sm btn-outline-secondary w-100">
                    <i className="bi bi-eye"></i> Показать все соединения
                  </button>
                </div>
              </div> */}
            </div>
          </>
        )}

        {/* Ресайзер с улучшенной визуализацией */}
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