import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as echarts from 'echarts/core';
import {
  PolarComponent,
  TooltipComponent
} from 'echarts/components';
import { CustomChart, LineChart, ScatterChart } from 'echarts/charts';
import { CanvasRenderer } from 'echarts/renderers';
import ReactECharts from "echarts-for-react";

echarts.use([
  PolarComponent,
  TooltipComponent,
  CustomChart,
  LineChart,
  ScatterChart,
  CanvasRenderer
]);


// Функция преобразования X/Y в полярные координаты
const convertToPolar = (x, y) => {
  const angle = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  const magnitude = Math.sqrt(x * x + y * y);
  return { angle, magnitude };
};

// Функция расчета наконечника стрелки
const calculateArrowHead = (endPoint, angleInDegrees, size = 10) => {
  const angleRad = angleInDegrees * Math.PI / 180;
  const arrowAngle = 25 * Math.PI / 180;
  
  const x1 = endPoint[0] - size * Math.cos(angleRad - arrowAngle);
  const y1 = endPoint[1] - size * Math.sin(angleRad - arrowAngle);
  const x2 = endPoint[0] - size * Math.cos(angleRad + arrowAngle);
  const y2 = endPoint[1] - size * Math.sin(angleRad + arrowAngle);
  
  return [[endPoint[0], endPoint[1]], [x1, y1], [x2, y2]];
};

// Функция преобразования HEX в RGB
const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

// Функция интерполяции цветов
const interpolateColor = (color1, color2, t) => {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  if (!c1 || !c2) return color1;
  
  const r = Math.round(c1.r + (c2.r - c1.r) * t);
  const g = Math.round(c1.g + (c2.g - c1.g) * t);
  const b = Math.round(c1.b + (c2.b - c1.b) * t);
  return `rgb(${r}, ${g}, ${b})`;
};

// Функция получения цвета по величине (градиент)
const getColorByMagnitude = (magnitude, maxMagnitude) => {
  if (maxMagnitude === 0) return '#4dabf7';
  const ratio = Math.min(magnitude / maxMagnitude, 1);
  
  if (ratio < 0.25) {
    const t = ratio / 0.25;
    return interpolateColor('#4dabf7', '#33d9b2', t);
  } else if (ratio < 0.5) {
    const t = (ratio - 0.25) / 0.25;
    return interpolateColor('#33d9b2', '#ffb800', t);
  } else if (ratio < 0.75) {
    const t = (ratio - 0.5) / 0.25;
    return interpolateColor('#ffb800', '#ff8c00', t);
  } else {
    const t = (ratio - 0.75) / 0.25;
    return interpolateColor('#ff8c00', '#ff6b6b', t);
  }
};

// ============================================
// КОМПОНЕНТ RADIALCHART
// ============================================

const RadialChart = ({ 
  vectorData = [],
  mode = 'current',
  width = '100%',
  height = '600px',
  maxHistorySize = 200
}) => {
  // State
  const chartRef = useRef(null);
  const [chartInstance, setChartInstance] = useState(null);
  const [option, setOption] = useState(null);
  const [currentVector, setCurrentVector] = useState(null);
  const [vectorHistory, setVectorHistory] = useState([]);
  const [autoScaleRange, setAutoScaleRange] = useState({ min: 0, max: 10 });
  const dpr = window.devicePixelRatio || 1;

  // Функция автомасштабирования
  const updateAutoScale = useCallback((vectors) => {
    if (!vectors || vectors.length === 0) return;
    
    const magnitudes = vectors.map(v => v.magnitude);
    const maxMagnitude = Math.max(...magnitudes);
    
    setAutoScaleRange({
      min: 0,
      max: maxMagnitude * 1.2
    });
  }, []);

  // Базовая конфигурация ECharts
  const getBaseOption = useCallback(() => ({
    animation: false,
    backgroundColor: 'transparent',
    
    polar: {
      center: ['50%', '50%'],
      radius: '85%'
    },
    
    angleAxis: {
      type: 'value',
      startAngle: 0,
      min: 0,
      max: 360,
      interval: 30,
      splitLine: {
        show: true,
        lineStyle: { color: '#444', width: 1 }
      },
      axisLine: {
        show: true,
        lineStyle: { color: '#888', width: 2 }
      },
      axisLabel: {
        formatter: '{value}°',
        color: '#fff',
        fontSize: 12
      }
    },
    
    radiusAxis: {
      type: 'value',
      min: 0,
      max: autoScaleRange.max,
      splitLine: {
        show: true,
        lineStyle: { color: '#444', width: 1 }
      },
      axisLine: {
        show: true,
        lineStyle: { color: '#888', width: 2 }
      },
      axisLabel: {
        formatter: (value) => value.toFixed(1),
        color: '#fff',
        fontSize: 11
      }
    },
    
    tooltip: {
      trigger: 'item',
      formatter: (params) => {
        const v = params.data?.vector || currentVector;
        if (!v) return '';
        
        return `
          <div style="padding: 8px;">
            <strong>Вектор</strong><br/>
            X: ${v.x.toFixed(3)}<br/>
            Y: ${v.y.toFixed(3)}<br/>
            Величина: ${v.magnitude.toFixed(3)}<br/>
            Угол: ${v.angle.toFixed(1)}°
          </div>
        `;
      }
    }
  }), [autoScaleRange.max, currentVector]);

  // Генерация опций для режима "Текущий вектор"
  const generateCurrentModeOption = useCallback(() => {
    if (!currentVector) return getBaseOption();
    
    const maxMag = autoScaleRange.max;
    const color = getColorByMagnitude(currentVector.magnitude, maxMag);
    
    return {
      ...getBaseOption(),
      series: [{
        type: 'custom',
        coordinateSystem: 'polar',
        renderItem: (params, api) => {
          const center = api.coord([0, 0]);
          const end = api.coord([currentVector.angle, currentVector.magnitude]);
          
          return {
            type: 'group',
            children: [
              {
                type: 'line',
                shape: {
                  x1: center[0],
                  y1: center[1],
                  x2: end[0],
                  y2: end[1]
                },
                style: {
                  stroke: color,
                  lineWidth: 3
                }
              },
              {
                type: 'polygon',
                shape: {
                  points: calculateArrowHead(end, currentVector.angle, 15)
                },
                style: {
                  fill: color
                }
              },
              {
                type: 'circle',
                shape: {
                  cx: end[0],
                  cy: end[1],
                  r: 6
                },
                style: {
                  fill: color,
                  stroke: '#fff',
                  lineWidth: 2
                }
              }
            ]
          };
        },
        data: [{ vector: currentVector }]
      }]
    };
  }, [currentVector, autoScaleRange.max, getBaseOption]);

  // Генерация опций для режима "История"
  const generateHistoryModeOption = useCallback(() => {
    if (!vectorHistory || vectorHistory.length === 0) return getBaseOption();
    
    const maxMag = autoScaleRange.max;
    
    return {
      ...getBaseOption(),
      series: [{
        type: 'custom',
        coordinateSystem: 'polar',
        renderItem: (params, api) => {
          const index = params.dataIndex;
          const vector = vectorHistory[index];
          const opacity = (index + 1) / vectorHistory.length;
          const color = getColorByMagnitude(vector.magnitude, maxMag);
          
          const center = api.coord([0, 0]);
          const end = api.coord([vector.angle, vector.magnitude]);
          
          return {
            type: 'group',
            children: [
              {
                type: 'line',
                shape: {
                  x1: center[0],
                  y1: center[1],
                  x2: end[0],
                  y2: end[1]
                },
                style: {
                  stroke: color,
                  lineWidth: 2,
                  opacity: opacity * 0.7
                }
              },
              {
                type: 'polygon',
                shape: {
                  points: calculateArrowHead(end, vector.angle, 10)
                },
                style: {
                  fill: color,
                  opacity: opacity * 0.7
                }
              }
            ]
          };
        },
        data: vectorHistory.map(v => ({ vector: v }))
      }]
    };
  }, [vectorHistory, autoScaleRange.max, getBaseOption]);

  // Генерация опций для режима "След"
  const generateTrailModeOption = useCallback(() => {
    if (!vectorHistory || vectorHistory.length === 0 || !currentVector) return getBaseOption();
    
    const maxMag = autoScaleRange.max;
    const currentColor = getColorByMagnitude(currentVector.magnitude, maxMag);
    
    return {
      ...getBaseOption(),
      series: [
        {
          type: 'line',
          coordinateSystem: 'polar',
          data: vectorHistory.map(v => [v.angle, v.magnitude]),
          lineStyle: {
            color: '#4dabf7',
            width: 2
          },
          showSymbol: false
        },
        {
          type: 'scatter',
          coordinateSystem: 'polar',
          data: vectorHistory.map((v, i) => ({
            value: [v.angle, v.magnitude],
            itemStyle: {
              color: getColorByMagnitude(v.magnitude, maxMag),
              opacity: (i + 1) / vectorHistory.length
            }
          })),
          symbolSize: 4
        },
        {
          type: 'scatter',
          coordinateSystem: 'polar',
          data: [[currentVector.angle, currentVector.magnitude]],
          symbolSize: 12,
          itemStyle: {
            color: currentColor,
            borderColor: '#fff',
            borderWidth: 2
          }
        }
      ]
    };
  }, [vectorHistory, currentVector, autoScaleRange.max, getBaseOption]);

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
          console.error('Ошибка при очистке радиального графика:', error);
        }
      }
    };
  }, [chartInstance]);

  // Обработка входящих данных
  useEffect(() => {
    if (!vectorData || vectorData.length === 0) return;
    
    const limitedData = vectorData.slice(-maxHistorySize);
    
    const processed = limitedData.map(v => ({
      x: v.x,
      y: v.y,
      ...convertToPolar(v.x, v.y),
      timestamp: v.timestamp
    }));
    
    setVectorHistory(processed);
    setCurrentVector(processed[processed.length - 1]);
    updateAutoScale(processed);
    
  }, [vectorData, maxHistorySize, updateAutoScale]);

  // Обновление графика при изменении режима или данных
  useEffect(() => {
    if (!chartInstance) return;
    
    let newOption;
    
    switch (mode) {
      case 'current':
        newOption = generateCurrentModeOption();
        break;
      case 'history':
        newOption = generateHistoryModeOption();
        break;
      case 'trail':
        newOption = generateTrailModeOption();
        break;
      default:
        newOption = generateCurrentModeOption();
    }
    
    setOption(newOption);
    
    if (chartInstance && typeof chartInstance.setOption === 'function') {
      try {
        chartInstance.setOption(newOption, true, false);
      } catch (error) {
        console.error('Ошибка обновления радиального графика:', error);
      }
    }
  }, [mode, currentVector, vectorHistory, chartInstance, generateCurrentModeOption, generateHistoryModeOption, generateTrailModeOption]);

  return (
    <div style={{ width, height }}>
      <ReactECharts
        ref={chartRef}
        option={option || getBaseOption()}
        notMerge={true}
        lazyUpdate={true}
        style={{ width, height }}
        opts={{ 
          renderer: 'canvas',
          devicePixelRatio: dpr * 2,
          cursor: 'grab'
        }}
      />
    </div>
  );
};

export default RadialChart;
