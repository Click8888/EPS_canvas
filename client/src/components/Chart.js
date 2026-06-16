import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as echarts from 'echarts/core';
import {
  TitleComponent,
  TooltipComponent,
  GridComponent
} from 'echarts/components';
import { LineChart } from 'echarts/charts';
import { UniversalTransition } from 'echarts/features';
import { CanvasRenderer } from 'echarts/renderers';
import ReactECharts from "echarts-for-react";
import { useTheme } from './ThemeContext';
import { useResizableLegend } from './useResizableLegend';

echarts.use([
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LineChart,
  CanvasRenderer,
  UniversalTransition
]);


// время -> строка 'ГГГГ-ММ-ДД ЧЧ:ММ:СС.мс'
const formatTime = (timeValue) => {
  if (timeValue === undefined || timeValue === null) return '';
  
  // время в секундах (меньше типичного timestamp)
  if (typeof timeValue === 'number' && timeValue < 1000000000) {
    const hours = Math.floor(timeValue / 3600);
    const minutes = Math.floor((timeValue % 3600) / 60);
    const seconds = Math.floor(timeValue % 60);
    const milliseconds = Math.floor((timeValue % 1) * 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  }
  
  // timestamp в секундах
  if (typeof timeValue === 'number' && timeValue > 1000000000) {
    const date = new Date(timeValue * 1000); // секунды -> мс
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const milliseconds = date.getMilliseconds().toString().padStart(3, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
  }
  
  // строка
  if (typeof timeValue === 'string') {
    // пробуем как Date (полная дата)
    const date = new Date(timeValue);
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const seconds = date.getSeconds().toString().padStart(2, '0');
      const milliseconds = date.getMilliseconds().toString().padStart(3, '0');
      
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
    }
    
    // иначе парсим время суток
    const timeMatch = timeValue.match(/(\d{1,2}):(\d{1,2}):(\d{1,2})(?:\.(\d+))?/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1]) || 0;
      const minutes = parseInt(timeMatch[2]) || 0;
      const seconds = parseInt(timeMatch[3]) || 0;
      const milliseconds = timeMatch[4] ? parseInt(timeMatch[4].substring(0, 3)) : 0;
      
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
    }
  }
  
  // объект Date
  if (timeValue instanceof Date) {
    const year = timeValue.getFullYear();
    const month = (timeValue.getMonth() + 1).toString().padStart(2, '0');
    const day = timeValue.getDate().toString().padStart(2, '0');
    const hours = timeValue.getHours().toString().padStart(2, '0');
    const minutes = timeValue.getMinutes().toString().padStart(2, '0');
    const seconds = timeValue.getSeconds().toString().padStart(2, '0');
    const milliseconds = timeValue.getMilliseconds().toString().padStart(3, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
  }
  
  return String(timeValue);
};

// только время (без даты) для оси X
const formatTimeOnly = (timeValue) => {
  if (timeValue === undefined || timeValue === null) return '';
  
  // время в секундах (меньше типичного timestamp)
  if (typeof timeValue === 'number' && timeValue < 1000000000) {
    const hours = Math.floor(timeValue / 3600);
    const minutes = Math.floor((timeValue % 3600) / 60);
    const seconds = Math.floor(timeValue % 60);
    const milliseconds = Math.floor((timeValue % 1) * 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  }
  
  // timestamp в секундах, берём только время
  if (typeof timeValue === 'number' && timeValue > 1000000000) {
    const date = new Date(timeValue * 1000);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const milliseconds = date.getMilliseconds().toString().padStart(3, '0');
    
    return `${hours}:${minutes}:${seconds}.${milliseconds}`;
  }
  
  // строка, вытаскиваем время
  if (typeof timeValue === 'string') {
    const timeMatch = timeValue.match(/(\d{1,2}):(\d{1,2}):(\d{1,2})(?:\.(\d+))?/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1]).toString().padStart(2, '0');
      const minutes = parseInt(timeMatch[2]).toString().padStart(2, '0');
      const seconds = parseInt(timeMatch[3]).toString().padStart(2, '0');
      const milliseconds = timeMatch[4] ? timeMatch[4].substring(0, 3).padStart(3, '0') : '000';
      
      return `${hours}:${minutes}:${seconds}.${milliseconds}`;
    }
  }
  
  // объект Date, берём только время
  if (timeValue instanceof Date) {
    const hours = timeValue.getHours().toString().padStart(2, '0');
    const minutes = timeValue.getMinutes().toString().padStart(2, '0');
    const seconds = timeValue.getSeconds().toString().padStart(2, '0');
    const milliseconds = timeValue.getMilliseconds().toString().padStart(3, '0');
    
    return `${hours}:${minutes}:${seconds}.${milliseconds}`;
  }
  
  return String(timeValue);
};

// время -> секунды (для числовой оси)
const convertTimeToSeconds = (timeValue) => {
  // уже секунды (относительное время)
  if (typeof timeValue === 'number' && timeValue < 1000000000) {
    return timeValue;
  }
  
  // timestamp в секундах
  if (typeof timeValue === 'number' && timeValue > 1000000000) {
    return timeValue;
  }
  
  if (typeof timeValue === 'string') {
  // сначала полная дата
  const fullDateMatch = timeValue.match(/\d{4}-\d{2}-\d{2}/);
  if (fullDateMatch) {
    const date = new Date(timeValue);
    if (!isNaN(date.getTime())) {
      return date.getTime() / 1000;
    }
  }
  
  // потом формат HH:MM:SS
  const timeMatch = timeValue.match(/^(\d{1,2}):(\d{1,2}):(\d{1,2})(?:\.(\d+))?$/);
  if (timeMatch) {
    const hours = parseInt(timeMatch[1], 10) || 0;
    const minutes = parseInt(timeMatch[2], 10) || 0;
    const seconds = parseInt(timeMatch[3], 10) || 0;
    
    let milliseconds = 0;
    if (timeMatch[4]) {
      // миллисекунды
      const msString = timeMatch[4].padEnd(3, '0').substring(0, 3);
      milliseconds = parseInt(msString, 10) / 1000;
    }
    
    return hours * 3600 + minutes * 60 + seconds + milliseconds;
  }
  
  // иначе парсим как число
  const parsed = parseFloat(timeValue);
  return isNaN(parsed) ? 0 : parsed;
}
  
  if (timeValue instanceof Date) {
    return timeValue.getTime() / 1000;
  }
  
  return 0;
};

const defaultOption = {
  animation: false,
  animationDuration: 0,
  animationEasing: 'linear',
  // общий шрифт для всего текста на канвасе
  textStyle: {
    fontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
  },
  // legend: {
  //   show: false,  // По умолчанию скрыта, будет показана при множественных линиях
  //   data: [],
  //   top: 10,
  //   left: 'center',
  //   textStyle: {
  //     color: '#fff',
  //     fontSize: 12
  //   },
  //   itemWidth: 25,
  //   itemHeight: 14
  // },
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'cross' },
    formatter: function(params) {
      if (!params || params.length === 0) return '';
      const timeValue = params[0].value[0];
      const formattedTime = formatTimeOnly(timeValue);
      const value = params[0].value[1];
      return `Время: ${formattedTime}<br/>Значение: ${parseFloat(value.toFixed(6)).toString()}`; //return parseFloat(params.value.toFixed(6)).toString();
    }
  },
  // axisPointer на осях
  axisPointer: {
    link: { xAxisIndex: 'all' },
    label: {
      formatter: function(params) {
        // формат времени только для оси X
        if (params.axisDimension === 'x') {
          return formatTimeOnly(params.value);
        }
        // для оси Y обычное число
        return parseFloat(params.value.toFixed(6)).toString();
      }
    }
  },
  xAxis: {
    type: 'value',
    nameLocation: 'middle',
    nameGap: 35,
    animation: false,
    axisLabel: {
      formatter: function(value) {
        return formatTimeOnly(value);
      },
      rotate: 0,
      interval: 'auto',
      hideOverlap: true, //перекрывающиеся метки
      showMinLabel: true, //показывать минимальную метку
      showMaxLabel: true
    },
    minInterval: 0.001,
    splitLine: {
      show: false //Линии от оси
    },
    axisTick: {
      show: true
    },
    axisLine: {
      show: true,
      onZero: true, // Ось будет проходить через 0
      lineStyle: {
        color: '#888',
        width: 2 // Жирная линия
      }
    }
  },
  yAxis: {
    type: 'value',
    scale: false,
    animation: false,
    axisLabel: {
      formatter: function(value) {
        // 6 значащих цифр
        return Number(value).toPrecision(6);
      }
    },
    minorTick: {
      show: true
    },
    splitLine: {
      show: true, //Линии от оси
      lineStyle: {
        color: '#444' // Цвет обычных линий сетки
      }
    },
    axisLine: {
      show: true,
      onZero: true, // Ось X будет проходить через Y = 0
      lineStyle: {
        color: '#888',
        width: 2 // Жирная линия для оси
      }
    }
  },
  dataZoom: [
    {
      id: 'insideZoom',
      show: true,
      type: 'inside',
      filterMode: 'none',
      xAxisIndex: [0],
      zoomOnMouseWheel: true,     // Зум колесиком мыши
      moveOnMouseMove: true,      // Перемещение зажатой ЛКМ ВКЛЮЧЕНО
      moveOnMouseWheel: false,    // Перемещение колесиком отключено
      preventDefaultMouseMove: true // Предотвращаем стандартное поведение
    }
  ],
  series: [
    {
      name: 'Данные',
      type: 'line',
      showSymbol: false,
      clip: true,
      connectNulls: false,
      itemStyle: {
        color: '#4dabf7'
      },
      lineStyle: {
        color: '#1f02c3',
        width: 2.2
      },
      data: []
    }
  ],
  grid: {
    left: '3%',
    right: '4%',
    bottom: '5%',
    top: '10%',
    containLabel: true,
  }
};

// форматтер тултипа, один раз на уровне модуля
const multiLineTooltipFormatter = (params) => {
  if (!params || params.length === 0) return '';
  const formattedTime = formatTimeOnly(params[0].value[0]);
  let tooltipContent = `Время: ${formattedTime}<br/>`;
  params.forEach(param => {
    const value = param.value[1];
    tooltipContent += `<span style="display:inline-block;width:10px;height:10px;background-color:${param.color};border-radius:50%;margin-right:5px;"></span>`;
    tooltipContent += `${param.seriesName}: ${parseFloat(value.toFixed(6)).toString()}<br/>`;
  });
  return tooltipContent;
};

// значение для легенды, без лишних нулей
const formatLegendValue = (v) => {
  if (v === undefined || v === null || isNaN(v)) return '—';
  return parseFloat(Number(v).toFixed(6)).toString();
};

// боковая легенда: цвет, имя, последнее значение линий
const LinearLegend = ({ entries, isDark }) => {
  const panelStyle = {
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
    overflowY: 'auto',
    padding: '14px',
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
    color: isDark ? '#fff' : '#333',
    fontSize: '12px',
    fontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`,
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale'
  };

  if (!entries || entries.length === 0) {
    return (
      <div className="nowheel" style={panelStyle}>
        <div style={{ textAlign: 'center', color: isDark ? '#aaa' : '#888', padding: '24px 8px' }}>
          <i className="bi bi-info-circle" style={{ fontSize: '28px', display: 'block', marginBottom: '10px', opacity: 0.6 }}></i>
          <div style={{ fontSize: '13px', fontWeight: 500 }}>Нет линий</div>
          <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.7 }}>Добавьте линии для отображения</div>
        </div>
      </div>
    );
  }

  return (
    <div className="nowheel" style={panelStyle}>
      <div style={{
        fontWeight: 600,
        marginBottom: '12px',
        paddingBottom: '8px',
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '13px'
      }}>
        <i className="bi bi-graph-up" style={{ fontSize: '14px' }}></i>
        <span>Серии</span>
        <span style={{
          marginLeft: 'auto',
          fontSize: '11px',
          backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)',
          padding: '2px 8px',
          borderRadius: '20px',
          fontWeight: 500
        }}>
          {entries.length}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {entries.map((entry, index) => (
          <div
            key={entry.id ?? index}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              padding: '8px 10px',
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
              borderRadius: '8px',
              borderLeft: `3px solid ${entry.color}`
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                width: '10px',
                height: '10px',
                borderRadius: '2px',
                backgroundColor: entry.color,
                flexShrink: 0
              }}></span>
              <span style={{ flex: 1, fontWeight: 500, fontSize: '12px', wordBreak: 'break-word' }}>
                {entry.name}
              </span>
            </div>
            <div style={{
              paddingLeft: '20px',
              fontSize: '11px',
              color: isDark ? '#ddd' : '#555',
              fontFamily: `'SF Mono', 'Monaco', 'Cascadia Code', monospace`
            }}>
              {formatLegendValue(entry.lastValue)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Chart = ({
  activeGraphUpdate,
  chartData,
  lines = [],
  width = '100%',
  height = '600px',
  isAutoUpdate = false,
  pointLimit = 200,
  // режим окна и границы диапазона (epoch-сек): points/relative тянут ось за данными, absolute фиксирует [start, end]
  rangeMode = 'points',
  rangeStartSec = null,
  rangeEndSec = null,
}) => {
  const { isDark } = useTheme();
  const chartRef = useRef(null);
  const containerRef = useRef(null); // контейнер графика и легенды
  const chartInstanceRef = useRef(null);
  const [chartInstance, setChartInstance] = useState(null);
  const currentXRangeRef = useRef(null);
  // взаимодействует ли пользователь с графиком
  const [userInteracting, setUserInteracting] = useState(false);
  const userInteractingRef = useRef(false); // для обработчиков событий
  const [, setCurrentXRange] = useState(null); // диапазон X после зума
  const prevLinesDataRef = useRef(null);
  const prevSeriesCountRef = useRef(0); // сколько серий было в прошлый раз

  // devicePixelRatio для чёткости
  const dpr = window.devicePixelRatio || 1;

  // данные одной линии в формат ECharts
const formatLineDataForECharts = (data) => {
  if (!data || !Array.isArray(data)) return [];

  // в режиме точек режем по pointLimit; в режимах диапазона выборку задаёт окно по времени
  const limit = (rangeMode === 'points' && pointLimit > 0) ? pointLimit : data.length;
  const limitedData = data.length > limit ? data.slice(-limit) : data;
  const formattedData = [];

  limitedData.forEach(item => {
    if (item && typeof item === 'object') {
      // item.time обычно уже в секундах; originalTime парсим только как fallback
      let timeInSeconds;
      if (typeof item.time === 'number') {
        timeInSeconds = item.time;
      } else if (item.originalTime !== undefined) {
        timeInSeconds = convertTimeToSeconds(item.originalTime);
      } else if (item.time !== undefined) {
        timeInSeconds = convertTimeToSeconds(item.time);
      } else {
        return;
      }

      // значение
      if (item.value !== undefined) {
        formattedData.push([timeInSeconds, item.value]);
      }
    }
  });

  return formattedData;
};

// все линии в формат ECharts
const formatAllLinesForECharts = (lines) => {
  if (!lines || !Array.isArray(lines) || lines.length === 0) {
    // fallback на старый формат
    if (chartData && Array.isArray(chartData)) {
      return [{
        name: 'Данные',
        color: '#1f02c3',
        data: formatLineDataForECharts(chartData)
      }];
    }
    return [];
  }

  return lines.map(line => ({
    name: line.name || 'Без названия',
    color: line.color || '#1f02c3',
    lineWidth: line.lineWidth,
    symbolSize: line.symbolSize,
    data: formatLineDataForECharts(line.data || [])
  }));
};

// диапазон Y по готовым данным [time, value], один проход
const calcYRangeFromFormatted = (formattedLines, xMin, xMax) => {
  let minY = Infinity;
  let maxY = -Infinity;
  const hasX = xMin !== null && xMin !== undefined && xMax !== null && xMax !== undefined;

  for (const line of formattedLines) {
    const data = line.data;
    if (!data) continue;
    for (let i = 0; i < data.length; i++) {
      const x = data[i][0];
      if (hasX && (x < xMin || x > xMax)) continue;
      const y = data[i][1];
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (minY === Infinity || maxY === -Infinity) {
    return { min: 0, max: 100 };
  }

  const range = maxY - minY || 1;
  const padding = range * 0.2;
  return { min: minY - padding, max: maxY + padding };
};

// диапазон X по данным с отступом 10%
const calcXRangeFromFormatted = (formattedLines) => {
  let minX = Infinity;
  let maxX = -Infinity;
  for (const line of formattedLines) {
    const data = line.data;
    if (!data) continue;
    for (let i = 0; i < data.length; i++) {
      const x = data[i][0];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
  }
  if (minX === Infinity) return null;
  const range = maxX - minX || 1;
  return { min: minX - range * 0.1, max: maxX + range * 0.1 };
};

  // берём готовый инстанс из onChartReady (в useEffect он мог быть ещё временным)
  const handleChartReady = useCallback((instance) => {
    chartInstanceRef.current = instance;
    setChartInstance(instance);
  }, []);

  // при размонтировании чистим ссылку
  useEffect(() => {
    return () => {
      chartInstanceRef.current = null;
    };
  }, []);

  // tooltip и зум зависят от автообновления, ставим отдельным merge. в автообновлении интеракции выключены
  useEffect(() => {
    const inst = chartInstanceRef.current;
    if (!inst || inst.isDisposed()) return;
    inst.setOption({
      tooltip: isAutoUpdate
        ? { show: false }
        : {
            show: true,
            trigger: 'axis',
            axisPointer: { type: 'cross' },
            formatter: multiLineTooltipFormatter
          },
      dataZoom: [{
        id: 'insideZoom',
        type: 'inside',
        zoomOnMouseWheel: !isAutoUpdate,
        moveOnMouseMove: !isAutoUpdate,
        moveOnMouseWheel: false
      }]
    }, false);
  }, [chartInstance, isAutoUpdate]);

  // следим за диапазоном X при зуме
useEffect(() => {
  if (!chartInstanceRef.current || chartInstanceRef.current.isDisposed()) return;

  const handleDataZoomEvent = (params) => {
  if (params.batch && params.batch.length > 0) {
    const xAxisZoom = params.batch.find(b => b.dataZoomId && b.xAxisIndex !== undefined);
    
    if (xAxisZoom) {
      // текущий диапазон X
      const option = chartInstance.getOption();
      if (option && option.xAxis && option.xAxis[0]) {
        let newXRange = null;
        
        // запоминаем диапазон X
        if (xAxisZoom.startValue !== undefined && xAxisZoom.endValue !== undefined) {
          newXRange = {
            min: xAxisZoom.startValue,
            max: xAxisZoom.endValue
          };
        } else if (xAxisZoom.start !== undefined && xAxisZoom.end !== undefined) {
          // проценты -> значения
          const allData = chartInstance.getOption().series[0].data || [];
          if (allData.length > 0) {
            const startIdx = Math.floor((xAxisZoom.start / 100) * allData.length);
            const endIdx = Math.ceil((xAxisZoom.end / 100) * allData.length);
            
            if (allData[startIdx] && allData[endIdx - 1]) {
              newXRange = {
                min: allData[startIdx][0],
                max: allData[endIdx - 1][0]
              };
            }
          }
        }
        
        // обновляем currentXRange и ось Y
        if (newXRange) {
          currentXRangeRef.current = newXRange;
          setCurrentXRange(newXRange);
          // диапазон Y по видимым данным
          const yRange = calcYRangeFromFormatted(
            formatAllLinesForECharts(lines),
            newXRange.min,
            newXRange.max
          );

          // обновляем только ось Y
          chartInstance.setOption({
            yAxis: {
              min: yRange.min,
              max: yRange.max
            }
          }, false, false);
        }
      }
    }
  }
};

chartInstanceRef.current.on('dataZoom', handleDataZoomEvent);

  return () => {
    // проверяем при очистке
    if (chartInstanceRef.current && !chartInstanceRef.current.isDisposed()) {
      chartInstanceRef.current.off('dataZoom', handleDataZoomEvent);
    }
  };
}, [chartInstance]);


  // следим за взаимодействием пользователя
  useEffect(() => {
    if (!chartInstanceRef.current || chartInstanceRef.current.isDisposed()) return;

    // событие dataZoom: пользователь зумит или двигает
    const handleDataZoom = (params) => {
      // только если это действие пользователя
      if (params.batch && params.batch.length > 0) {
        const isUserAction = params.batch[0].start !== undefined || params.batch[0].end !== undefined;
        if (isUserAction) {
          userInteractingRef.current = true;
          setUserInteracting(true);
        }
      }
    };

    // событие restore: сброс зума
    const handleRestore = () => {
      userInteractingRef.current = false;
      setUserInteracting(false);
    };

    // подписка на события
    chartInstanceRef.current.on('dataZoom', handleDataZoom);
    chartInstanceRef.current.on('restore', handleRestore);

    // отписка при размонтировании
    return () => {
      // проверяем при очистке
      if (chartInstanceRef.current && !chartInstanceRef.current.isDisposed()) {
        chartInstanceRef.current.off('dataZoom', handleDataZoom);
        chartInstanceRef.current.off('restore', handleRestore);
      }
    };
  }, [chartInstance]);

// при смене лимита/режима сбрасываем сохранённый зум, чтобы график снова следовал за данными
useEffect(() => {
  userInteractingRef.current = false;
  setUserInteracting(false);
  currentXRangeRef.current = null;
  setCurrentXRange(null);
}, [pointLimit, rangeMode, rangeStartSec, rangeEndSec]);

// при включении автообновления тоже сбрасываем зум: интеракции выключены, график следует за данными
useEffect(() => {
  if (!isAutoUpdate) return;
  userInteractingRef.current = false;
  setUserInteracting(false);
  currentXRangeRef.current = null;
  setCurrentXRange(null);
  prevLinesDataRef.current = null;
}, [isAutoUpdate]);

// обновление данных: один setOption на series.data и границы осей, остальное не трогаем
useEffect(() => {
  const inst = chartInstanceRef.current;
  if (!inst || inst.isDisposed()) return;

  // лёгкая сигнатура изменений вместо JSON.stringify всех точек
  let sig = `lim:${pointLimit}|rm:${rangeMode}|rs:${rangeStartSec}|re:${rangeEndSec}|`;
  for (let i = 0; i < lines.length; i++) {
    const d = lines[i].data;
    const len = d ? d.length : 0;
    const last = len > 0 ? d[len - 1] : null;
    // стиль (цвет/толщина/точки) тоже в сигнатуре, чтобы смена стиля сразу перерисовала
    sig += `${lines[i].id}:${len}:${last ? last.time : ''}:${lines[i].color}:${lines[i].lineWidth}:${lines[i].symbolSize}|`;
  }
  if (prevLinesDataRef.current === sig) {
    // данные не изменились, пропускаем
    return;
  }
  prevLinesDataRef.current = sig;

  // форматируем линии в [time, value]
  const formattedLines = formatAllLinesForECharts(lines);

  // fallback на старый формат chartData
  if (formattedLines.length === 0 && chartData) {
    formattedLines.push({
      name: 'Данные',
      color: '#1f02c3',
      data: formatLineDataForECharts(chartData)
    });
  }
  if (formattedLines.length === 0) return;

  // при взаимодействии держим диапазон X пользователя и считаем Y по видимому окну
  const interacting = userInteractingRef.current;
  // абсолютный режим: фиксируем окно [start, end] и считаем Y по нему
  const absoluteWindow =
    rangeMode === 'absolute' && rangeStartSec != null && rangeEndSec != null
      ? { min: rangeStartSec, max: rangeEndSec }
      : null;
  const xRange = interacting
    ? currentXRangeRef.current
    : absoluteWindow;

  const yRange = calcYRangeFromFormatted(
    formattedLines,
    xRange?.min ?? null,
    xRange?.max ?? null
  );

  const series = formattedLines.map(line => {
    // стили серий из сайдбара
    const width = line.lineWidth ?? 2.2;
    const symbolSize = line.symbolSize ?? 0;
    const showSymbol = symbolSize > 0;
    return {
      name: line.name,
      type: 'line',
      showSymbol,
      symbolSize: showSymbol ? symbolSize : 4,
      clip: true,
      connectNulls: false,
      animation: false,
      sampling: 'lttb',
      itemStyle: { color: line.color },
      lineStyle: { color: line.color, width },
      data: line.data
    };
  });

  // если линий стало меньше, добиваем пустыми сериями, иначе при merge останутся старые
  for (let i = series.length; i < prevSeriesCountRef.current; i++) {
    series.push({ type: 'line', data: [] });
  }
  prevSeriesCountRef.current = formattedLines.length;

  const updateOption = {
    yAxis: { min: yRange.min, max: yRange.max },
    series
  };

  // без взаимодействия задаём ось X: абсолютный режим фиксирует окно, иначе ось следует за данными
  if (!interacting) {
    if (absoluteWindow) {
      updateOption.xAxis = { min: absoluteWindow.min, max: absoluteWindow.max };
    } else {
      const xr = calcXRangeFromFormatted(formattedLines);
      if (xr) {
        updateOption.xAxis = { min: xr.min, max: xr.max };
      }
    }
  }

  try {
    // merge: меняем только data серий и границы осей
    inst.setOption(updateOption, false, false);
  } catch (error) {
    console.error('Ошибка обновления графика:', error);
  }
}, [chartData, lines, activeGraphUpdate, chartInstance, pointLimit, isAutoUpdate, rangeMode, rangeStartSec, rangeEndSec]);

  // стартовая ширина легенды (~28%, 220..360px), дальше тянется мышью
  const totalW = typeof width === 'number' ? width : null;
  const defaultLegendWidth = totalW ? Math.min(360, Math.max(220, Math.round(totalW * 0.28))) : 280;
  const [legendWidth, startLegendResize] = useResizableLegend(containerRef, totalW, defaultLegendWidth);

  // записи легенды: имя, цвет, последнее значение
  let legendEntries = [];
  if (lines && lines.length > 0) {
    legendEntries = lines.map((line) => {
      const d = line.data;
      const lastValue = d && d.length > 0 ? d[d.length - 1].value : null;
      return {
        id: line.id,
        name: line.name || 'Без названия',
        color: line.color || '#1f02c3',
        lastValue
      };
    });
  } else if (chartData && Array.isArray(chartData) && chartData.length > 0) {
    legendEntries = [{
      id: 'data',
      name: 'Данные',
      color: '#1f02c3',
      lastValue: chartData[chartData.length - 1]?.value ?? null
    }];
  }

  return (
    <div
      id="graph"
      ref={containerRef}
      style={{
        width: width,
        height: height,
        position: 'relative',
        display: 'flex'
      }}
    >
      <div
        className="chart-canvas-area"
        style={{
          flex: 1,
          minWidth: 0,
          height: '100%',
          position: 'relative'
          // курсор crosshair задаётся в CSS (с !important поверх zrender)
        }}
      >
        <ReactECharts
          ref={chartRef}
          option={defaultOption}
          notMerge={true}
          lazyUpdate={true}
          onChartReady={handleChartReady}
          autoResize
          style={{
            width: '100%',
            height: '100%',
            minHeight: '300px'
          }}
          opts={{
            renderer: 'canvas',
            // канвас в повышенной плотности пикселей, чтобы было чётче (на слабом железе можно снизить кап до 3)
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
        <LinearLegend entries={legendEntries} isDark={isDark} />
      </div>
    </div>

  );
};

export default Chart;