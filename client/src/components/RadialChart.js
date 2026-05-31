import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as echarts from 'echarts/core';
import { useTheme } from './ThemeContext';
import {
  PolarComponent,
  TooltipComponent
} from 'echarts/components';
import { CustomChart } from 'echarts/charts';
import { CanvasRenderer } from 'echarts/renderers';
import ReactECharts from "echarts-for-react";
import { useResizableLegend } from './useResizableLegend';

echarts.use([
  PolarComponent,
  TooltipComponent,
  CustomChart,
  CanvasRenderer
]);

// Функция интерполяции цветов
const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

const interpolateColor = (color1, color2, t) => {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  if (!c1 || !c2) return color1;
  
  const r = Math.round(c1.r + (c2.r - c1.r) * t);
  const g = Math.round(c1.g + (c2.g - c1.g) * t);
  const b = Math.round(c1.b + (c2.b - c1.b) * t);
  return `rgb(${r}, ${g}, ${b})`;
};

// Функция получения цвета с приоритетом пользовательского цвета
const getVectorColor = (vector, maxMagnitude) => {
  // Если задан пользовательский цвет, используем его
  if (vector.color && vector.color !== '#4dabf7') {
    return vector.color;
  }
  
  // Иначе вычисляем цвет на основе величины
  if (maxMagnitude === 0) return '#4dabf7';
  const ratio = Math.min(vector.magnitude / maxMagnitude, 1);
  
  if (ratio < 0.25) return interpolateColor('#4dabf7', '#33d9b2', ratio / 0.25);
  else if (ratio < 0.5) return interpolateColor('#33d9b2', '#ffb800', (ratio - 0.25) / 0.25);
  else if (ratio < 0.75) return interpolateColor('#ffb800', '#ff8c00', (ratio - 0.5) / 0.25);
  else return interpolateColor('#ff8c00', '#ff6b6b', (ratio - 0.75) / 0.25);
};

// Компонент легенды
const Legend = ({ vectors, maxMagnitude, isDark }) => {
  const dpr = window.devicePixelRatio || 1;
  const isHighDPI = dpr >= 2;

  const legendStyles = {
    // Боковая колонка справа (раньше — плавающий оверлей в углу).
    position: 'relative',
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
    padding: '14px',
    overflowY: 'auto',
    fontSize: '12px',
    pointerEvents: 'auto',
    fontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif`,
    letterSpacing: '0.01em',
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale',
    textRendering: 'geometricPrecision'
  };

  if (!vectors || vectors.length === 0) {
    return (
      <div className="radial-legend nowheel" style={legendStyles}>
        <div style={{
          textAlign: 'center',
          color: isDark ? '#aaa' : '#666',
          padding: '24px 16px'
        }}>
          <i className="bi bi-info-circle" style={{ fontSize: '32px', display: 'block', marginBottom: '12px', opacity: 0.6 }}></i>
          <div style={{ fontSize: '13px', fontWeight: 500 }}>Нет данных</div>
          <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.7 }}>Добавьте векторы для отображения</div>
        </div>
      </div>
    );
  }

  return (
    <div className="radial-legend nowheel" style={legendStyles}>
      <div style={{
        fontWeight: '600',
        marginBottom: '12px',
        paddingBottom: '8px',
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
        color: isDark ? '#fff' : '#333',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '13px'
      }}>
        <i className="bi bi-list-ul" style={{ fontSize: '14px' }}></i>
        <span>Векторы</span>
        <span style={{
          marginLeft: 'auto',
          fontSize: '11px',
          backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)',
          padding: '2px 8px',
          borderRadius: '20px',
          fontWeight: '500'
        }}>
          {vectors.length}
        </span>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {vectors.map((vector, index) => {
          const color = getVectorColor(vector, maxMagnitude);
          
          return (
            <div 
              key={vector.id || index}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                padding: '10px',
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                borderRadius: '8px',
                borderLeft: `3px solid ${color}`,
                transition: 'all 0.15s ease',
                transform: 'translateZ(0)'
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontWeight: '500'
              }}>
                <div style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '2px',
                  backgroundColor: color,
                  boxShadow: isHighDPI ? `0 0 0 0.5px ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'}` : 'none'
                }}></div>
                <span style={{ 
                  color: isDark ? '#fff' : '#333', 
                  flex: 1,
                  fontSize: '12px',
                  fontWeight: '500'
                }}>
                  {vector.name || `Вектор ${index + 1}`}
                </span>
              </div>
              
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr',
                gap: '6px 12px',
                paddingLeft: '20px',
                fontSize: '11px'
              }}>
                <div style={{ color: isDark ? '#999' : '#888', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <i className="bi bi-compass" style={{ fontSize: '10px' }}></i>
                  <span>Угол:</span>
                </div>
                <div style={{ color: isDark ? '#ddd' : '#555', fontWeight: '500', fontFamily: 'monospace' }}>
                  {vector.angle.toFixed(1)}°
                </div>
                
                <div style={{ color: isDark ? '#999' : '#888', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <i className="bi bi-arrow-right" style={{ fontSize: '10px' }}></i>
                  <span>Длина:</span>
                </div>
                <div style={{ color: isDark ? '#ddd' : '#555', fontWeight: '500', fontFamily: 'monospace' }}>
                  {vector.magnitude.toFixed(4)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const RadialChart = ({ 
  lines = [],
  width = '100%',
  height = '600px',
  isAutoUpdate = false,
}) => {
  const { isDark } = useTheme();
  const chartRef = useRef(null);
  const [chartInstance, setChartInstance] = useState(null);
  const [option, setOption] = useState(null);
  const dpr = window.devicePixelRatio || 1;
  const isHighDPI = dpr >= 2;
  
  // Сохраняем векторы в ref для доступа в renderItem и tooltip
  const vectorsRef = useRef([]);
  const maxMagRef = useRef(100);
  const containerRef = useRef(null); // внешний flex-контейнер (график + легенда)

  // Преобразование данных линий в векторы
  const processLinesToVectors = useCallback(() => {
    if (!lines || lines.length === 0) return [];
    
    const vectors = [];
    
    lines.forEach(line => {
      if (!line.data || !Array.isArray(line.data) || line.data.length === 0) return;
      
      const lastPoint = line.data[line.data.length - 1];
      
      let angle, magnitude;
      
      if (lastPoint.angle !== undefined) {
        angle = parseFloat(lastPoint.angle);
        magnitude = parseFloat(lastPoint.value !== undefined ? lastPoint.value : lastPoint.magnitude);
      } else if (lastPoint.x !== undefined) {
        angle = parseFloat(lastPoint.x);
        magnitude = parseFloat(lastPoint.y);
      } else {
        return;
      }
      
      if (!isNaN(angle) && !isNaN(magnitude)) {
        vectors.push({
          id: line.id,
          name: line.name,
          color: line.color || '#4dabf7', // Сохраняем пользовательский цвет
          angle: angle % 360,
          magnitude: Math.abs(magnitude),
        });
      }
    });
    
    return vectors;
  }, [lines]);

  // Вычисление максимальной длины с запасом
  const getMaxMagnitude = useCallback((vectors) => {
    if (vectors.length === 0) return 100;
    
    const maxMagnitude = Math.max(...vectors.map(v => v.magnitude));
    if (maxMagnitude === 0) return 100;
    
    return maxMagnitude * 1.25;
  }, []);

  // Генерация опций графика
  const generateOption = useCallback(() => {
    const vectors = processLinesToVectors();
    const maxMag = getMaxMagnitude(vectors);
    
    // Сохраняем в ref для использования в tooltip и renderItem
    vectorsRef.current = vectors;
    maxMagRef.current = maxMag;
    
    const baseOption = {
      animation: false,
      backgroundColor: 'transparent',
      polar: {
        center: ['50%', '50%'],
        radius: ['0%', '90%']
      },
      angleAxis: {
        type: 'value',
        startAngle: 0,
        min: 0,
        max: 360,
        interval: 30,
        clockwise: false,
        splitLine: {
          show: true,
          lineStyle: { color: isDark ? '#444' : '#e0e0e0', width: isHighDPI ? 1 : 1.5 }
        },
        axisLine: {
          show: true,
          lineStyle: { color: isDark ? '#888' : '#666', width: isHighDPI ? 1.5 : 2 }
        },
        axisLabel: {
          formatter: '{value}°',
          color: isDark ? '#fff' : '#333',
          fontSize: isHighDPI ? 11 : 12,
          margin: 12,
          fontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
        }
      },
      radiusAxis: {
        type: 'value',
        min: 0,
        max: maxMag,
        scale: false,
        splitNumber: 4,
        splitLine: {
          show: true,
          lineStyle: { color: isDark ? '#444' : '#e0e0e0', width: isHighDPI ? 0.5 : 1 }
        },
        axisLine: {
          show: true,
          lineStyle: { color: isDark ? '#888' : '#666', width: isHighDPI ? 1.5 : 2 }
        },
        axisLabel: {
          formatter: (value) => value.toFixed(2),
          color: isDark ? '#fff' : '#333',
          fontSize: isHighDPI ? 10 : 11,
          margin: 12,
          fontFamily: `'SF Mono', 'Monaco', 'Cascadia Code', monospace`
        }
      },
      
      tooltip: !isAutoUpdate ? {
        trigger: 'item',
        enterable: true,
        backgroundColor: isDark ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        borderColor: isDark ? '#444' : '#ddd',
        borderWidth: 1,
        textStyle: {
          color: isDark ? '#fff' : '#333',
          fontSize: 12,
          fontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
        },
        extraCssText: 'box-shadow: 0 4px 12px rgba(0,0,0,0.15); border-radius: 8px; backdrop-filter: blur(4px);',
        formatter: (params) => {
          if (!params || params.dataIndex === undefined) return '';
          
          const vector = vectorsRef.current[params.seriesIndex];
          if (!vector) return '';
          
          return `
            <div style="padding: 8px 12px;">
              <strong style="font-size: 13px;">${vector.name || 'Без названия'}</strong><br/>
              <span style="font-size: 11px; opacity: 0.7;">Угол:</span> <strong>${vector.angle.toFixed(1)}°</strong><br/>
              <span style="font-size: 11px; opacity: 0.7;">Длина:</span> <strong>${vector.magnitude.toFixed(4)}</strong>
            </div>
          `;
        }
      } : { show: false },
    };

    // Создаем серии для каждого вектора
    const series = vectors.map((vector, index) => {
      // Используем getVectorColor для получения цвета (с приоритетом пользовательского)
      const color = getVectorColor(vector, maxMag);
      
      return {
        type: 'custom',
        coordinateSystem: 'polar',
        name: vector.name || 'Без названия',
        data: [[vector.angle, vector.magnitude]],
        itemStyle: {
          color: color
        },
        renderItem: (params, api) => {
          const angle = api.value(0);
          const magnitude = api.value(1);
          
          const center = api.coord([0, 0]);
          
          const chartWidth = api.getWidth();
          const chartHeight = api.getHeight();
          
          const polarRadius = Math.min(chartWidth, chartHeight) * 0.4;
          
          const angleRad = (angle * Math.PI) / 180;
          
          const pixelLength = (magnitude / maxMag) * polarRadius;
          const clampedLength = Math.min(pixelLength, polarRadius * 0.95);
          
          const endX = center[0] + clampedLength * Math.cos(angleRad);
          const endY = center[1] - clampedLength * Math.sin(angleRad);
          
          const arrowSize = isHighDPI ? 8 : 10;
          
          return {
            type: 'group',
            children: [
              {
                type: 'line',
                shape: {
                  x1: center[0],
                  y1: center[1],
                  x2: endX,
                  y2: endY
                },
                style: {
                  stroke: color,
                  lineWidth: isHighDPI ? 2.5 : 3,
                  opacity: 0.9
                },
                emphasis: {
                  style: {
                    lineWidth: isHighDPI ? 4 : 5,
                    opacity: 1,
                    shadowBlur: isHighDPI ? 4 : 8,
                    shadowColor: color
                  }
                }
              },
              {
                type: 'polygon',
                shape: {
                  points: [
                    [endX, endY],
                    [endX - arrowSize * Math.cos(angleRad - 0.5), endY + arrowSize * Math.sin(angleRad - 0.5)],
                    [endX - arrowSize * Math.cos(angleRad + 0.5), endY + arrowSize * Math.sin(angleRad + 0.5)]
                  ]
                },
                style: {
                  fill: color,
                  stroke: color,
                  lineWidth: isHighDPI ? 0.5 : 1,
                  shadowBlur: isHighDPI ? 2 : 4,
                  shadowColor: color
                }
              }
            ]
          };
        }
      };
    });

    return {
      ...baseOption,
      series
    };
  }, [lines, processLinesToVectors, getMaxMagnitude, isDark, isAutoUpdate, isHighDPI]);

  // Инициализация графика
  useEffect(() => {
    if (chartRef.current && !chartInstance) {
      try {
        const instance = chartRef.current.getEchartsInstance();
        if (instance) {
          setChartInstance(instance);
          instance.resize();
        }
      } catch (error) {
        console.error('Ошибка инициализации радиального графика:', error);
      }
    }

    return () => {
      if (chartInstance && typeof chartInstance.dispose === 'function') {
        try {
          chartInstance.dispose();
        } catch (error) {
          console.error('Ошибка при очистке:', error);
        }
      }
    };
  }, [chartInstance]);

  // Обновление графика при изменении данных
  useEffect(() => {
    if (!chartInstance) return;
    
    const newOption = generateOption();
    setOption(newOption);
    
    if (chartInstance.resize) {
      chartInstance.resize();
    }
  }, [lines, chartInstance, generateOption]);

  // Получаем векторы для легенды
  const vectors = processLinesToVectors();
  const maxMag = getMaxMagnitude(vectors);

  // Авто-ширина боковой колонки легенды (~28%, [220,360]px) — стартовое значение;
  // дальше пользователь может менять её, перетаскивая разделитель.
  const totalW = typeof width === 'number' ? width : null;
  const defaultLegendWidth = totalW ? Math.min(360, Math.max(220, Math.round(totalW * 0.28))) : 280;
  const [legendWidth, startLegendResize] = useResizableLegend(containerRef, totalW, defaultLegendWidth);

  return (
    <div ref={containerRef} style={{
      width,
      height,
      display: 'flex',
      backgroundColor: isDark ? '#1e1e1e' : '#ffffff',
      borderRadius: '12px',
      overflow: 'hidden'
    }}>
      <div style={{ flex: 1, minWidth: 0, height: '100%', position: 'relative' }}>
        <ReactECharts
          ref={chartRef}
          option={option || {}}
          notMerge={true}
          lazyUpdate={false}
          style={{ width: '100%', height: '100%' }}
          opts={{
            renderer: 'canvas',
            // Суперсэмплинг: рендерим канвас в повышенной плотности пикселей →
            // чёткие линии/стрелки и подписи. Та же стратегия, что в линейном графике.
            devicePixelRatio: Math.min(dpr * 2, 4)
          }}
        />
      </div>

      <div
        className="legend-resizer nodrag"
        onMouseDown={startLegendResize}
        title="Потяните, чтобы изменить ширину легенды"
      />

      <div style={{ width: legendWidth, flexShrink: 0, height: '100%' }}>
        <Legend vectors={vectors} maxMagnitude={maxMag} isDark={isDark} />
      </div>
    </div>
  );
};

export default RadialChart;