import React, { useEffect, useRef, useMemo, useCallback } from 'react';
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

// hex -> rgb
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

// цвет вектора: свой, иначе по величине
const getVectorColor = (vector, maxMagnitude) => {
  // если задан свой цвет, берём его
  if (vector.color && vector.color !== '#4dabf7') {
    return vector.color;
  }
  
  // иначе считаем цвет по величине
  if (maxMagnitude === 0) return '#4dabf7';
  const ratio = Math.min(vector.magnitude / maxMagnitude, 1);
  
  if (ratio < 0.25) return interpolateColor('#4dabf7', '#33d9b2', ratio / 0.25);
  else if (ratio < 0.5) return interpolateColor('#33d9b2', '#ffb800', (ratio - 0.25) / 0.25);
  else if (ratio < 0.75) return interpolateColor('#ffb800', '#ff8c00', (ratio - 0.5) / 0.25);
  else return interpolateColor('#ff8c00', '#ff6b6b', (ratio - 0.75) / 0.25);
};

// легенда
const Legend = ({ vectors, maxMagnitude, isDark }) => {
  const dpr = window.devicePixelRatio || 1;
  const isHighDPI = dpr >= 2;

  const legendStyles = {
    // боковая колонка справа
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
  const chartBoxRef = useRef(null); // контейнер канваса — отслеживаем его ресайз
  const dpr = window.devicePixelRatio || 1;
  const isHighDPI = dpr >= 2;
  
  // векторы в ref, чтобы читать их в renderItem и tooltip
  const vectorsRef = useRef([]);
  const maxMagRef = useRef(100);
  const containerRef = useRef(null); // контейнер графика и легенды

  // из линий делаем векторы
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
          color: line.color || '#4dabf7', // свой цвет линии
          angle: angle % 360,
          magnitude: Math.abs(magnitude),
          lineWidth: line.lineWidth, // толщина стрелки из сайдбара
          arrowScale: line.arrowScale, // масштаб наконечника из сайдбара
        });
      }
    });
    
    return vectors;
  }, [lines]);

  // макс. длина с запасом
  const getMaxMagnitude = useCallback((vectors) => {
    if (vectors.length === 0) return 100;
    
    const maxMagnitude = Math.max(...vectors.map(v => v.magnitude));
    if (maxMagnitude === 0) return 100;
    
    return maxMagnitude * 1.25;
  }, []);

  // собираем option для echarts
  const generateOption = useCallback(() => {
    const vectors = processLinesToVectors();
    const maxMag = getMaxMagnitude(vectors);
    
    // в ref для tooltip и renderItem
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

    // серия на каждый вектор
    const series = vectors.map((vector, index) => {
      // цвет через getVectorColor
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

          // толщина древка и пользовательский масштаб наконечника
          const lw = vector.lineWidth ?? (isHighDPI ? 2.5 : 3);
          const arrowScale = vector.arrowScale ?? 1;

          // острый (sleek) наконечник, пропорциональный толщине линии
          let headLength = Math.max(lw * 3.5, 7) * arrowScale;
          const headHalfW = Math.max(lw * 1.6, 3.5) * arrowScale;
          // защита для коротких векторов, чтобы головка не «съела» древко
          headLength = Math.min(headLength, clampedLength * 0.9);

          // единичный вектор направления (экранные координаты, y инвертирован) и перпендикуляр
          const ux = Math.cos(angleRad);
          const uy = -Math.sin(angleRad);
          const px = -uy;
          const py = ux;

          // основание головки и её крылья
          const baseX = endX - headLength * ux;
          const baseY = endY - headLength * uy;
          const leftX = baseX + headHalfW * px;
          const leftY = baseY + headHalfW * py;
          const rightX = baseX - headHalfW * px;
          const rightY = baseY - headHalfW * py;

          // древко заканчивается внутри головки — убирает шов и protrusion у кончика
          const shaftX = endX - headLength * 0.85 * ux;
          const shaftY = endY - headLength * 0.85 * uy;

          return {
            type: 'group',
            children: [
              {
                type: 'line',
                shape: {
                  x1: center[0],
                  y1: center[1],
                  x2: shaftX,
                  y2: shaftY
                },
                style: {
                  stroke: color,
                  lineWidth: lw,
                  lineCap: 'round'
                },
                emphasis: {
                  style: {
                    lineWidth: lw + 1.5,
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
                    [leftX, leftY],
                    [rightX, rightY]
                  ]
                },
                style: {
                  fill: color,
                  stroke: color,
                  lineWidth: isHighDPI ? 0.5 : 1,
                  lineJoin: 'round'
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

  // option считается напрямую из данных; инстансом ECharts владеет echarts-for-react.
  // Раньше инстанс хранился в state и вручную dispose/resize — но echarts-for-react
  // мог пересоздать инстанс (например, при смене devicePixelRatio), и сохранённая
  // ссылка устаревала: resize() уходил на уже уничтоженный инстанс, заваливая
  // консоль предупреждениями "[ECharts] Instance ... has been disposed" на каждом
  // тике автообновления.
  const option = useMemo(() => generateOption(), [generateOption]);

  // Стабильный opts: новый объектный литерал на каждый рендер заставлял
  // echarts-for-react пересоздавать инстанс.
  const echartsOpts = useMemo(() => ({
    renderer: 'canvas',
    // канвас в повышенной плотности пикселей, чтобы было чётче
    devicePixelRatio: Math.min(dpr * 2, 4)
  }), [dpr]);

  // Ресайз графика при изменении размеров контейнера (узел/легенда).
  // Живой инстанс берём из рефа на каждый вызов и проверяем isDisposed(),
  // чтобы никогда не дёргать уничтоженный инстанс.
  useEffect(() => {
    const el = chartBoxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const ro = new ResizeObserver(() => {
      const inst = chartRef.current?.getEchartsInstance?.();
      if (inst && !inst.isDisposed?.()) inst.resize();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // векторы для легенды
  const vectors = processLinesToVectors();
  const maxMag = getMaxMagnitude(vectors);

  // стартовая ширина легенды (~28%, 220..360px), дальше тянется мышью
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
      <div ref={chartBoxRef} style={{ flex: 1, minWidth: 0, height: '100%', position: 'relative' }}>
        <ReactECharts
          ref={chartRef}
          option={option}
          notMerge={true}
          lazyUpdate={false}
          style={{ width: '100%', height: '100%' }}
          opts={echartsOpts}
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