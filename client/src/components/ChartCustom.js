import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';

import Chart from './Chart.js'

const ChartCustom = ({ 
  data = [], 
  series = [],
  colors = {},
  type = 'linear',
  isUpdating = false,
  onSeriesToggle,
  chartId,
  realTime = false,
  dataType = 'current',
  containerWidth,
  containerHeight,
}) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const animationRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const wsRef = useRef(null);
  
  // Локальное состояние данных с уникальными ключами
  const [chartData, setChartData] = useState([]);
  const [dataMap, setDataMap] = useState(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const lastProcessedTimeRef = useRef(0);
  const dataKeyCounterRef = useRef(0);
  const isFollowingRef = useRef(true); // Флаг следования за новыми данными
  const viewportLockRef = useRef(false); // Блокировка вьюпорта при ручном управлении

  // Настройки графика
  const [chartState, setChartState] = useState({
    scale: 1.0,
    viewport: {
      minX: 0,
      maxX: 100,
      minY: 0,
      maxY: 100
    },
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    hoverInfo: null
  });

  const [visibleSeries, setVisibleSeries] = useState({});

  // Цвета по умолчанию
  const {
    backgroundColor = '#2a2a2a',
    textColor = '#ffffff',
    lineColor = '#133592',
    gridColor = '#444'
  } = colors;


  // Вспомогательная функция для красивого шага сетки
  const getNiceStep = useCallback((value) => {
    if (value <= 0) return 1;
    const exponent = Math.floor(Math.log10(value));
    const fraction = value / Math.pow(10, exponent);
    
    let niceFraction;
    if (fraction < 1.5) niceFraction = 1;
    else if (fraction < 3) niceFraction = 2;
    else if (fraction < 7) niceFraction = 5;
    else niceFraction = 10;
    
    return niceFraction * Math.pow(10, exponent);
  }, []);

  // Форматирование времени
  const formatTime = useCallback((seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = (seconds % 60).toFixed(2);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.padStart(5, '0')}`;
    } else if (minutes > 0) {
      return `${minutes}:${secs.padStart(5, '0')}`;
    } else {
      return secs + 'с';
    }
  }, []);

  // Преобразование координат
  const worldToScreen = useCallback((x, y) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const { minX, maxX, minY, maxY } = chartState.viewport;
    const width = canvas.width;
    const height = canvas.height;

    const screenX = ((x - minX) / (maxX - minX)) * width;
    const screenY = height - ((y - minY) / (maxY - minY)) * height;

    return { x: screenX, y: screenY };
  }, [chartState.viewport]);

  const screenToWorld = useCallback((screenX, screenY) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const { minX, maxX, minY, maxY } = chartState.viewport;
    const width = canvas.width;
    const height = canvas.height;

    const worldX = (screenX / width) * (maxX - minX) + minX;
    const worldY = ((height - screenY) / height) * (maxY - minY) + minY;

    return { x: worldX, y: worldY };
  }, [chartState.viewport]);

  // Функция для создания уникального ключа точки данных
  const createDataKey = useCallback((time, value) => {
    return `${time.toFixed(6)}_${value.toFixed(6)}_${dataKeyCounterRef.current++}`;
  }, []);

  // Преобразование времени HH:MM:SS.mmm в секунды
  const timeToSeconds = useCallback((timeString) => {
    if (!timeString) return 0;
    
    // Если уже число, возвращаем как есть
    if (typeof timeString === 'number') {
      return timeString;
    }
    
    // Если это объект Date
    if (timeString instanceof Date) {
      return timeString.getTime() / 1000;
    }
    
    const [timePart, millisecondsPart] = timeString.split('.');
    const [hours, minutes, seconds] = timePart.split(':').map(Number);
    const milliseconds = millisecondsPart ? parseInt(millisecondsPart) : 0;
    
    return hours * 3600 + minutes * 60 + seconds + (milliseconds / 1000);
  }, []);

  // Функция для обработки и валидации данных
const processChartData = useCallback((rawData, seriesId = 'main') => {
  if (!rawData || !Array.isArray(rawData)) return [];

  const validData = [];
  const seenTimes = new Set();
  
  // Проверяем формат данных
  console.log('Обработка данных:', rawData.length, 'элементов');
  
  // Если данные уже в формате {time, value}
  if (rawData.length > 0 && rawData[0].time != null && rawData[0].value != null) {
    // Сортируем по времени
    const sortedData = [...rawData].sort((a, b) => {
      const timeA = a?.time != null ? timeToSeconds(a.time) : 0;
      const timeB = b?.time != null ? timeToSeconds(b.time) : 0;
      return timeA - timeB;
    });
    
    for (let i = 0; i < sortedData.length; i++) {
      const item = sortedData[i];
      
      const timeInSeconds = timeToSeconds(item.time);
      const numericValue = parseFloat(item.value);
      
      if (!isNaN(numericValue) && !isNaN(timeInSeconds)) {
        const timeKey = `${seriesId}_${timeInSeconds.toFixed(6)}`;
        
        if (!seenTimes.has(timeKey)) {
          seenTimes.add(timeKey);
          
          validData.push({
            key: createDataKey(timeInSeconds, numericValue),
            time: timeInSeconds,
            value: numericValue,
            seriesId: seriesId,
            originalTime: item.originalTime || item.time,
            overload: item.overload || false,
            timestamp: Date.now()
          });
        }
      }
    }
  } else {
    // Если данные в другом формате, пытаемся адаптировать
    console.warn('Нестандартный формат данных:', rawData[0]);
  }

  return validData;
}, [timeToSeconds, createDataKey]);

  // Инициализация видимости серий
  useEffect(() => {
    const initialVisibility = {};
    series.forEach(s => {
      initialVisibility[s.id] = s.enabled !== false;
    });
    setVisibleSeries(initialVisibility);
  }, [series]);

  // Инициализация данных при первом рендере
  useEffect(() => {
    if (data.length > 0) {
      const processed = processChartData(data, 'main');
      const newMap = new Map();
      
      processed.forEach(point => {
        newMap.set(point.key, point);
      });
      
      setChartData(processed);
      setDataMap(newMap);
      lastProcessedTimeRef.current = Math.max(...processed.map(p => p.time), 0);
    }
  }, [data, processChartData]);

  // Сортировка основных данных по времени
  const sortedChartData = useMemo(() => 
    [...chartData].sort((a, b) => a.time - b.time),
  [chartData]);

  // Подготовленные серии (сортировка по времени) БЕЗ ОГРАНИЧЕНИЙ
  const processedSeries = useMemo(() => 
    series
      .filter(s => visibleSeries[s.id] !== false)
      .map(s => {
        const processed = processChartData(s.data || [], `series_${s.id}`);
        return {
          ...s,
          processedData: processed,
          sortedData: [...processed].sort((a, b) => a.time - b.time)
        };
      }), 
  [series, visibleSeries, processChartData]);

  // Определяем границы всех данных
  const getDataBounds = useCallback(() => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    // Основные данные
    sortedChartData.forEach(point => {
      minX = Math.min(minX, point.time);
      maxX = Math.max(maxX, point.time);
      minY = Math.min(minY, point.value);
      maxY = Math.max(maxY, point.value);
    });

    // Данные серий
    processedSeries.forEach(seriesItem => {
      seriesItem.sortedData.forEach(point => {
        minX = Math.min(minX, point.time);
        maxX = Math.max(maxX, point.time);
        minY = Math.min(minY, point.value);
        maxY = Math.max(maxY, point.value);
      });
    });

    // Если нет данных, возвращаем стандартные значения
    if (minX === Infinity) {
      return { minX: 0, maxX: 100, minY: 0, maxY: 100 };
    }

    // Добавляем немного отступа
    const xRange = maxX - minX || 1;
    const yRange = maxY - minY || 1;
    
    return {
      minX: minX,
      maxX: maxX + xRange * 0.05,
      minY: minY - yRange * 0.1,
      maxY: maxY + yRange * 0.1
    };
  }, [sortedChartData, processedSeries]);

  // Определяем границы для "движущегося" окна (последние N секунд)
  const getMovingWindowBounds = useCallback((windowSizeSeconds = 30) => {
    if (sortedChartData.length === 0) {
      return { minX: 0, maxX: 100, minY: 0, maxY: 100 };
    }

    const latestTime = sortedChartData[sortedChartData.length - 1].time;
    const minX = Math.max(0, latestTime - windowSizeSeconds);
    const maxX = latestTime;

    // Находим minY и maxY среди точек в окне
    let minY = Infinity;
    let maxY = -Infinity;
    
    // Точки в окне
    const pointsInWindow = sortedChartData.filter(p => p.time >= minX && p.time <= maxX);
    
    pointsInWindow.forEach(point => {
      minY = Math.min(minY, point.value);
      maxY = Math.max(maxY, point.value);
    });

    // Также учитываем серии
    processedSeries.forEach(seriesItem => {
      const seriesPointsInWindow = seriesItem.sortedData.filter(p => p.time >= minX && p.time <= maxX);
      seriesPointsInWindow.forEach(point => {
        minY = Math.min(minY, point.value);
        maxY = Math.max(maxY, point.value);
      });
    });

    // Если не нашли значений
    if (minY === Infinity) {
      minY = 0;
      maxY = 100;
    }

    // Добавляем отступы
    const yRange = maxY - minY || 1;
    
    return {
      minX: minX,
      maxX: maxX,
      minY: minY - yRange * 0.1,
      maxY: maxY + yRange * 0.1
    };
  }, [sortedChartData, processedSeries]);

  // Автоматическое смещение вьюпорта за новыми данными
  useEffect(() => {
    if (!isUpdating || sortedChartData.length === 0 || !isFollowingRef.current || viewportLockRef.current) {
      return;
    }

    // Используем окно последних 30 секунд
    const windowBounds = getMovingWindowBounds(30);
    
    // Плавно смещаем окно
    setChartState(prev => {
      const currentWidth = prev.viewport.maxX - prev.viewport.minX;
      const targetMinX = windowBounds.minX;
      const targetMaxX = windowBounds.maxX;
      
      // Плавный переход к новым границам
      const smoothFactor = 0.3;
      const newMinX = prev.viewport.minX + (targetMinX - prev.viewport.minX) * smoothFactor;
      const newMaxX = prev.viewport.maxX + (targetMaxX - prev.viewport.maxX) * smoothFactor;
      
      return {
        ...prev,
        viewport: {
          minX: newMinX,
          maxX: newMaxX,
          minY: windowBounds.minY,
          maxY: windowBounds.maxY
        }
      };
    });
  }, [sortedChartData, isUpdating, getMovingWindowBounds]);

  // Рисование сетки
  const drawGrid = useCallback((ctx, canvas) => {
    const { minX, maxX, minY, maxY } = chartState.viewport;
    const width = canvas.width;
    const height = canvas.height;

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5;

    // Вертикальные линии
    const xRange = maxX - minX;
    const gridStepX = getNiceStep(xRange / 10);
    
    for (let x = Math.ceil(minX / gridStepX) * gridStepX; x <= maxX; x += gridStepX) {
      const pos = worldToScreen(x, minY);
      ctx.beginPath();
      ctx.moveTo(pos.x, 0);
      ctx.lineTo(pos.x, height);
      ctx.stroke();

      // Подписи
      if (pos.x >= 50 && pos.x <= width - 50) {
        ctx.fillStyle = textColor;
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(formatTime(x), pos.x, height - 10);
      }
    }

    // Горизонтальные линии
    const yRange = maxY - minY;
    const gridStepY = getNiceStep(yRange / 10);
    
    for (let y = Math.ceil(minY / gridStepY) * gridStepY; y <= maxY; y += gridStepY) {
      const pos = worldToScreen(minX, y);
      ctx.beginPath();
      ctx.moveTo(0, pos.y);
      ctx.lineTo(width, pos.y);
      ctx.stroke();

      // Подписи
      if (pos.y >= 20 && pos.y <= height - 20) {
        ctx.fillStyle = textColor;
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(y.toFixed(2), 45, pos.y + 3);
      }
    }
  }, [chartState.viewport, gridColor, textColor, worldToScreen, getNiceStep, formatTime]);

  // Рисование осей
  const drawAxes = useCallback((ctx, canvas) => {
    const { minX, maxX, minY, maxY } = chartState.viewport;
    const width = canvas.width;
    const height = canvas.height;

    ctx.strokeStyle = textColor;
    ctx.lineWidth = 1;

    // Ось Y
    const originX = worldToScreen(0, minY).x;
    if (originX >= 0 && originX <= width) {
      ctx.beginPath();
      ctx.moveTo(originX, 0);
      ctx.lineTo(originX, height);
      ctx.stroke();
    }

    // Ось X
    const originY = worldToScreen(minX, 0).y;
    if (originY >= 0 && originY <= height) {
      ctx.beginPath();
      ctx.moveTo(0, originY);
      ctx.lineTo(width, originY);
      ctx.stroke();
    }
  }, [chartState.viewport, textColor, worldToScreen]);

  // Рисование линии для последовательных точек (оптимизировано)
  const drawLine = useCallback((ctx, points, color, lineWidth = 2, dashed = false) => {
    if (points.length < 2) return;

    // Берем только точки, которые попадают в вьюпорт или рядом с ним
    const { minX, maxX } = chartState.viewport;
    const margin = (maxX - minX) * 0.1; // 10% отступа
    const visiblePoints = points.filter(p => 
      p.time >= minX - margin && 
      p.time <= maxX + margin
    );

    if (visiblePoints.length < 2) return;

    // Оптимизация: децимация если точек слишком много
    let pointsToDraw = visiblePoints;
    if (visiblePoints.length > 5000) {
      // Простая децимация: берем каждый N-ый элемент
      const step = Math.ceil(visiblePoints.length / 5000);
      pointsToDraw = [];
      for (let i = 0; i < visiblePoints.length; i += step) {
        pointsToDraw.push(visiblePoints[i]);
      }
      // Всегда добавляем первую и последнюю точки
      if (!pointsToDraw.includes(visiblePoints[0])) {
        pointsToDraw.unshift(visiblePoints[0]);
      }
      if (!pointsToDraw.includes(visiblePoints[visiblePoints.length - 1])) {
        pointsToDraw.push(visiblePoints[visiblePoints.length - 1]);
      }
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    if (dashed) {
      ctx.setLineDash([5, 5]);
    } else {
      ctx.setLineDash([]);
    }

    // Начинаем путь с первой точки
    const firstPoint = pointsToDraw[0];
    const firstScreen = worldToScreen(firstPoint.time, firstPoint.value);
    
    ctx.beginPath();
    ctx.moveTo(firstScreen.x, firstScreen.y);

    // Рисуем линию строго по порядку времени
    for (let i = 1; i < pointsToDraw.length; i++) {
      const point = pointsToDraw[i];
      const screen = worldToScreen(point.time, point.value);
      ctx.lineTo(screen.x, screen.y);
    }

    ctx.stroke();
    ctx.setLineDash([]);
  }, [chartState.viewport, worldToScreen]);

  // Рисование точек перегрузки (только видимые)
  const drawOverloadPoints = useCallback((ctx, points, color, pointSize = 3) => {
    const { minX, maxX } = chartState.viewport;
    const visiblePoints = points.filter(p => 
      p.overload && 
      p.time >= minX && 
      p.time <= maxX
    );
    
    if (visiblePoints.length === 0) return;
    
    // Ограничиваем количество точек перегрузки
    const maxOverloadPoints = 100;
    let pointsToDraw = visiblePoints;
    if (visiblePoints.length > maxOverloadPoints) {
      const step = Math.ceil(visiblePoints.length / maxOverloadPoints);
      pointsToDraw = [];
      for (let i = 0; i < visiblePoints.length; i += step) {
        pointsToDraw.push(visiblePoints[i]);
      }
    }
    
    ctx.fillStyle = color;
    
    pointsToDraw.forEach(point => {
      const pos = worldToScreen(point.time, point.value);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, pointSize, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [chartState.viewport, worldToScreen]);

  // Рисование всех точек (только видимые и немного)
  const drawAllPoints = useCallback((ctx, points, color, pointSize = 2) => {
    const { minX, maxX } = chartState.viewport;
    const visiblePoints = points.filter(p => 
      p.time >= minX && 
      p.time <= maxX
    );
    
    // Рисуем точки только если их немного
    if (visiblePoints.length > 200) return;
    
    ctx.fillStyle = color;
    
    visiblePoints.forEach(point => {
      const pos = worldToScreen(point.time, point.value);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, pointSize, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [chartState.viewport, worldToScreen]);

  // Рисование hover линии
  const drawHoverLine = useCallback((ctx, canvas) => {
    const { hoverInfo } = chartState;
    if (!hoverInfo) return;

    const pos = worldToScreen(hoverInfo.time, hoverInfo.value);
    
    // Вертикальная линия
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    
    ctx.beginPath();
    ctx.moveTo(pos.x, 0);
    ctx.lineTo(pos.x, canvas.height);
    ctx.stroke();
    
    // Горизонтальная линия
    ctx.beginPath();
    ctx.moveTo(0, pos.y);
    ctx.lineTo(canvas.width, pos.y);
    ctx.stroke();
    
    // Точка
    ctx.fillStyle = hoverInfo.seriesColor || '#ffffff';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.setLineDash([]);
  }, [chartState.hoverInfo, worldToScreen]);

  // Отрисовка графика
  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Очищаем canvas
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Рисуем сетку
    drawGrid(ctx, canvas);

    // Рисуем оси
    drawAxes(ctx, canvas);

    // Рисуем дополнительные серии
    processedSeries.forEach(seriesItem => {
      if (seriesItem.sortedData?.length > 0) {
        drawLine(
          ctx, 
          seriesItem.sortedData, 
          seriesItem.color || '#ff0000', 
          seriesItem.width || 1,
          seriesItem.style === 'dashed'
        );
        
        // Отмечаем точки перегрузки для серий
        drawOverloadPoints(ctx, seriesItem.sortedData, '#ff0000', 2);
        
        // Если точек немного, рисуем все точки
        drawAllPoints(ctx, seriesItem.sortedData, seriesItem.color || '#ff0000', 1);
      }
    });

    // Рисуем основную линию
    if (sortedChartData.length > 0) {
      drawLine(ctx, sortedChartData, lineColor, 2);
      
      // Отмечаем точки перегрузки
      drawOverloadPoints(ctx, sortedChartData, '#ff0000', 3);
      
      // Если точек немного, рисуем все точки
      drawAllPoints(ctx, sortedChartData, lineColor, 2);
    }

    // Рисуем hover линию если есть
    if (chartState.hoverInfo) {
      drawHoverLine(ctx, canvas);
    }
  }, [
    backgroundColor, gridColor, textColor, lineColor, 
    sortedChartData, processedSeries, chartState.viewport, chartState.hoverInfo, 
    worldToScreen, drawGrid, drawAxes, drawLine, drawOverloadPoints, 
    drawAllPoints, drawHoverLine, isConnected
  ]);

  // Обработчики взаимодействия
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const worldPos = screenToWorld(mouseX, mouseY);
    const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
    
    setChartState(prev => {
      const newScale = Math.max(0.1, Math.min(10, prev.scale * zoomFactor));
      
      // Масштабирование относительно точки курсора
      const ratio = 1 / zoomFactor;
      const newViewport = {
        minX: worldPos.x - (worldPos.x - prev.viewport.minX) * ratio,
        maxX: worldPos.x + (prev.viewport.maxX - worldPos.x) * ratio,
        minY: worldPos.y - (worldPos.y - prev.viewport.minY) * ratio,
        maxY: worldPos.y + (prev.viewport.maxY - worldPos.y) * ratio
      };

      return {
        ...prev,
        scale: newScale,
        viewport: newViewport
      };
    });
    
    // При ручном управлении блокируем автослежение
    isFollowingRef.current = false;
    viewportLockRef.current = true;
  }, [screenToWorld]);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setChartState(prev => ({
      ...prev,
      isDragging: true,
      dragStart: { x, y },
      hoverInfo: null
    }));
    
    // При начале перетаскивания блокируем автослежение
    isFollowingRef.current = false;
    viewportLockRef.current = true;
  }, []);

  const handleMouseMove = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Если перетаскиваем
    if (chartState.isDragging) {
      const dx = mouseX - chartState.dragStart.x;
      const dy = mouseY - chartState.dragStart.y;

      const worldDx = (dx / canvas.width) * (chartState.viewport.maxX - chartState.viewport.minX);
      const worldDy = (dy / canvas.height) * (chartState.viewport.maxY - chartState.viewport.minY);

      setChartState(prev => ({
        ...prev,
        viewport: {
          minX: prev.viewport.minX - worldDx,
          maxX: prev.viewport.maxX - worldDx,
          minY: prev.viewport.minY + worldDy,
          maxY: prev.viewport.maxY + worldDy
        },
        dragStart: { x: mouseX, y: mouseY }
      }));
    } 
    // Если просто наведение
    else {
      const worldPos = screenToWorld(mouseX, mouseY);
      
      // Ищем ближайшую точку только среди видимых
      const { minX, maxX } = chartState.viewport;
      const visiblePoints = sortedChartData.filter(p => 
        p.time >= minX && 
        p.time <= maxX
      );
      
      let closestPoint = null;
      let minDistance = Infinity;
      let closestSeriesColor = null;

      // Проверяем основную серию
      visiblePoints.forEach(point => {
        const distance = Math.abs(point.time - worldPos.x);
        if (distance < minDistance) {
          minDistance = distance;
          closestPoint = point;
          closestSeriesColor = lineColor;
        }
      });

      // Проверяем дополнительные серии
      processedSeries.forEach(seriesItem => {
        const visibleSeriesPoints = seriesItem.sortedData.filter(p => 
          p.time >= minX && 
          p.time <= maxX
        );
        
        visibleSeriesPoints.forEach(point => {
          const distance = Math.abs(point.time - worldPos.x);
          if (distance < minDistance) {
            minDistance = distance;
            closestPoint = point;
            closestSeriesColor = seriesItem.color || '#ff0000';
          }
        });
      });

      // Если нашли достаточно близкую точку
      const xRange = maxX - minX;
      if (closestPoint && minDistance < xRange * 0.02) {
        setChartState(prev => ({
          ...prev,
          hoverInfo: {
            time: closestPoint.time,
            value: closestPoint.value,
            seriesColor: closestSeriesColor
          }
        }));
      } else {
        setChartState(prev => ({
          ...prev,
          hoverInfo: null
        }));
      }
    }
  }, [chartState.isDragging, chartState.dragStart, chartState.viewport, screenToWorld, sortedChartData, processedSeries, lineColor]);

  const handleMouseUp = useCallback(() => {
    setChartState(prev => ({
      ...prev,
      isDragging: false
    }));
  }, []);

  const handleMouseLeave = useCallback(() => {
    setChartState(prev => ({
      ...prev,
      isDragging: false,
      hoverInfo: null
    }));
  }, []);

  const handleDoubleClick = useCallback(() => {
    // Автомасштабирование по всем данным
    const bounds = getDataBounds();
    setChartState(prev => ({
      ...prev,
      viewport: bounds,
      scale: 1.0
    }));
    
    // При даблклике включаем автослежение
    isFollowingRef.current = true;
    viewportLockRef.current = false;
  }, [getDataBounds]);

  const handleZoomIn = useCallback(() => {
    setChartState(prev => ({
      ...prev,
      scale: Math.min(10, prev.scale * 1.2),
      viewport: {
        minX: prev.viewport.minX + (prev.viewport.maxX - prev.viewport.minX) * 0.1,
        maxX: prev.viewport.maxX - (prev.viewport.maxX - prev.viewport.minX) * 0.1,
        minY: prev.viewport.minY + (prev.viewport.maxY - prev.viewport.minY) * 0.1,
        maxY: prev.viewport.maxY - (prev.viewport.maxY - prev.viewport.minY) * 0.1
      }
    }));
    
    // При ручном зуме блокируем автослежение
    isFollowingRef.current = false;
    viewportLockRef.current = true;
  }, []);

  const handleZoomOut = useCallback(() => {
    setChartState(prev => ({
      ...prev,
      scale: Math.max(0.1, prev.scale * 0.8),
      viewport: {
        minX: prev.viewport.minX - (prev.viewport.maxX - prev.viewport.minX) * 0.1,
        maxX: prev.viewport.maxX + (prev.viewport.maxX - prev.viewport.minX) * 0.1,
        minY: prev.viewport.minY - (prev.viewport.maxY - prev.viewport.minY) * 0.1,
        maxY: prev.viewport.maxY + (prev.viewport.maxY - prev.viewport.minY) * 0.1
      }
    }));
    
    // При ручном зуме блокируем автослежение
    isFollowingRef.current = false;
    viewportLockRef.current = true;
  }, []);

  const handleFollowToggle = useCallback(() => {
    isFollowingRef.current = !isFollowingRef.current;
    viewportLockRef.current = !isFollowingRef.current;
    
    // Если включаем слежение, перемещаемся к последним данным
    if (isFollowingRef.current && sortedChartData.length > 0) {
      const windowBounds = getMovingWindowBounds(30);
      setChartState(prev => ({
        ...prev,
        viewport: windowBounds
      }));
    }
  }, [sortedChartData, getMovingWindowBounds]);

  const handleSeriesToggle = useCallback((seriesId) => {
    setVisibleSeries(prev => {
      const newVisibility = {
        ...prev,
        [seriesId]: !prev[seriesId]
      };
      
      if (onSeriesToggle) {
        onSeriesToggle(seriesId, newVisibility[seriesId]);
      }
      
      return newVisibility;
    });
  }, [onSeriesToggle]);

  // Добавление новых точек (НИКАКИХ ОГРАНИЧЕНИЙ)
  const addDataPoint = useCallback((newPoint) => {
    if (!newPoint || newPoint.time == null || newPoint.value == null) return;

    const timeInSeconds = timeToSeconds(newPoint.time);
    const numericValue = parseFloat(newPoint.value);
    
    if (isNaN(numericValue) || isNaN(timeInSeconds)) return;
    
    const pointKey = createDataKey(timeInSeconds, numericValue);
    
    if (!dataMap.has(pointKey)) {
      const newDataPoint = {
        key: pointKey,
        time: timeInSeconds,
        value: numericValue,
        seriesId: newPoint.seriesId || 'main',
        originalTime: newPoint.time,
        overload: newPoint.overload || false,
        timestamp: Date.now()
      };
      
      setDataMap(prev => {
        const newMap = new Map(prev);
        newMap.set(pointKey, newDataPoint);
        return newMap;
      });
      
      // ДОБАВЛЯЕМ ТОЧКУ БЕЗ УДАЛЕНИЯ СТАРЫХ
      setChartData(prev => [...prev, newDataPoint]);
      lastProcessedTimeRef.current = Math.max(lastProcessedTimeRef.current, timeInSeconds);
    }
  }, [timeToSeconds, createDataKey, dataMap]);

  // Запуск/остановка генерации через API
  const handleStartGeneration = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8080/api/generation/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          interval: 50,
          chartId: chartId
        })
      });
      
      if (response.ok) {
        console.log('Генерация запущена');
      }
    } catch (error) {
      console.error('Ошибка запуска генерации:', error);
    }
  }, [chartId]);

  const handleStopGeneration = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8080/api/generation/stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (response.ok) {
        console.log('Генерация остановлена');
      }
    } catch (error) {
      console.error('Ошибка остановки генерации:', error);
    }
  }, []);

  // Обновите функцию updateCanvasSize:
  const updateCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    
    if (!canvas) return;
    
    const dpr = window.devicePixelRatio || 1;
    
    // Если переданы containerWidth и containerHeight, используем их
    let width, height;
    
    if (containerWidth && containerHeight) {
      // Учитываем padding и border узла
      width = containerWidth; // 15px padding с каждой стороны
      height = containerHeight; // высота header + footer
    } else if (container) {
      const rect = container.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
    } else {
      width = 400; // fallback
      height = 200;
    }
    
    // Ограничиваем минимальные размеры
    width = Math.max(100, width);
    height = Math.max(100, height);
    
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
    
    // Перерисовываем график
    drawChart();
  }, [containerWidth, containerHeight, drawChart]);
  
  // Обновите useEffect для инициализации размеров:
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    
    if (!canvas) return;
    
    updateCanvasSize();
    
    // Создаем ResizeObserver для отслеживания изменений размеров контейнера
    resizeObserverRef.current = new ResizeObserver(() => {
      updateCanvasSize();
    });
    
    if (container) {
      resizeObserverRef.current.observe(container);
    }
    
    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
    };
  }, [updateCanvasSize]);

  // Основной цикл отрисовки
  useEffect(() => {
    const render = () => {
      drawChart();
      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [drawChart]);

  // Очистка данных при изменении типа или ID графика
  useEffect(() => {
    return () => {
      setChartData([]);
      setDataMap(new Map());
      lastProcessedTimeRef.current = 0;
    };
  }, [chartId, dataType]);

  // Легенда графика
  const Legend = () => {
    if (series.length === 0 && sortedChartData.length === 0) return null;

    return (
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        backgroundColor: 'rgba(42, 42, 42, 0.9)',
        padding: '10px',
        borderRadius: '5px',
        border: '1px solid #555',
        zIndex: 10,
        minWidth: '180px',
        maxWidth: '250px',
        backdropFilter: 'blur(2px)'
      }}>
        <div style={{ 
          color: textColor, 
          marginBottom: '8px',
          borderBottom: '1px solid #555',
          paddingBottom: '5px',
          fontSize: '12px',
          fontWeight: 'bold'
        }}>
          Легенда
        </div>
        
        {/* Основная серия */}
        {sortedChartData.length > 0 && (
          <div 
            className="legend-item" 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              marginBottom: '6px',
              padding: '2px',
              borderRadius: '3px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)'
            }}
          >
            <div style={{
              width: '20px',
              height: '3px',
              backgroundColor: lineColor,
              marginRight: '10px',
              borderRadius: '2px'
            }}></div>
            <span style={{ color: textColor, fontSize: '11px', flex: 1 }}>Основная серия</span>
            <span style={{ color: '#888', fontSize: '10px' }}>
              {sortedChartData.length.toLocaleString()}
            </span>
          </div>
        )}

        {/* Дополнительные серии */}
        {series.map(seriesItem => {
          const isVisible = visibleSeries[seriesItem.id];
          const seriesData = seriesItem.data || [];
          
          return (
            <div 
              key={seriesItem.id}
              className="legend-item" 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                marginBottom: '6px',
                padding: '2px',
                borderRadius: '3px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                cursor: 'pointer',
                opacity: isVisible ? 1 : 0.4,
                transition: 'opacity 0.2s'
              }}
              onClick={() => handleSeriesToggle(seriesItem.id)}
              title={isVisible ? "Кликните чтобы скрыть" : "Кликните чтобы показать"}
            >
              <div style={{
                width: '20px',
                height: seriesItem.width || 1,
                backgroundColor: seriesItem.color || '#ff0000',
                marginRight: '10px',
                borderRadius: '2px',
                borderStyle: seriesItem.style === 'dashed' ? 'dashed' : 'solid',
                borderWidth: '1px',
                borderColor: seriesItem.color || '#ff0000'
              }}></div>
              <span style={{ color: textColor, fontSize: '11px', flex: 1 }}>
                {seriesItem.name || `Серия ${seriesItem.id}`}
              </span>
              <span style={{ color: '#888', fontSize: '10px' }}>
                {seriesData.length.toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const hasData = sortedChartData?.length > 0 || processedSeries.some(s => s.sortedData?.length > 0);

  // Обработчик для предотвращения контекстного меню
  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  return (
    <div 
      ref={containerRef}
      style={{ 
        width: '100%', 
        height: '100%', 
        position: 'relative',
        cursor: chartState.isDragging ? 'grabbing' : 'crosshair',
        overflow: 'hidden'
      }}
      onContextMenu={handleContextMenu} // ДОБАВИТЬ ЭТО
    >
    <Chart 
      data={data}

    />
      {/* <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu} // ДОБАВИТЬ ЭТО
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          userSelect: 'none'
        }}
      /> */}
      
      {!hasData && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: '#888',
          textAlign: 'center',
          zIndex: 5,
          pointerEvents: 'none'
        }}>
          <i className="bi bi-bar-chart" style={{ fontSize: '2rem', display: 'block', marginBottom: '10px' }}></i>
          <span>Нет данных для отображения</span>
        </div>
      )}

      {/* Элементы управления */}
      <div style={{
        position: 'absolute',
        bottom: '10px',
        right: '10px',
        display: 'flex',
        gap: '5px',
        zIndex: 10
      }}>
      </div>

      {/* Индикатор перетаскивания */}
      {chartState.isDragging && (
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: '#fff',
          padding: '5px 10px',
          borderRadius: '3px',
          fontSize: '12px',
          zIndex: 10
        }}>
          Перетаскивание...
        </div>
      )}
    </div>
  );
};

export default ChartCustom;