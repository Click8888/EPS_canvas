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


// Функция для форматирования времени в формат ГГГГ-ММ-ДД ЧЧ:ММ:СС.мс
const formatTime = (timeValue) => {
  if (timeValue === undefined || timeValue === null) return '';
  
  // Если время в секундах (число меньше типичного timestamp)
  if (typeof timeValue === 'number' && timeValue < 1000000000) {
    const hours = Math.floor(timeValue / 3600);
    const minutes = Math.floor((timeValue % 3600) / 60);
    const seconds = Math.floor(timeValue % 60);
    const milliseconds = Math.floor((timeValue % 1) * 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  }
  
  // Если время в секундах (timestamp)
  if (typeof timeValue === 'number' && timeValue > 1000000000) {
    const date = new Date(timeValue * 1000); // Конвертируем секунды в миллисекунды
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const milliseconds = date.getMilliseconds().toString().padStart(3, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
  }
  
  // Если время в виде строки
  if (typeof timeValue === 'string') {
    // Пробуем преобразовать в Date (для полных дат)
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
    
    // Пробуем распарсить строку времени (только время суток)
    const timeMatch = timeValue.match(/(\d{1,2}):(\d{1,2}):(\d{1,2})(?:\.(\d+))?/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1]) || 0;
      const minutes = parseInt(timeMatch[2]) || 0;
      const seconds = parseInt(timeMatch[3]) || 0;
      const milliseconds = timeMatch[4] ? parseInt(timeMatch[4].substring(0, 3)) : 0;
      
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
    }
  }
  
  // Если это объект Date
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

// Функция для форматирования только времени (без даты) для оси X
const formatTimeOnly = (timeValue) => {
  if (timeValue === undefined || timeValue === null) return '';
  
  // Если время в секундах (число меньше типичного timestamp)
  if (typeof timeValue === 'number' && timeValue < 1000000000) {
    const hours = Math.floor(timeValue / 3600);
    const minutes = Math.floor((timeValue % 3600) / 60);
    const seconds = Math.floor(timeValue % 60);
    const milliseconds = Math.floor((timeValue % 1) * 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  }
  
  // Если timestamp в секундах - извлекаем только время
  if (typeof timeValue === 'number' && timeValue > 1000000000) {
    const date = new Date(timeValue * 1000);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const milliseconds = date.getMilliseconds().toString().padStart(3, '0');
    
    return `${hours}:${minutes}:${seconds}.${milliseconds}`;
  }
  
  // Если строка - пытаемся извлечь время
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
  
  // Если объект Date - извлекаем только время
  if (timeValue instanceof Date) {
    const hours = timeValue.getHours().toString().padStart(2, '0');
    const minutes = timeValue.getMinutes().toString().padStart(2, '0');
    const seconds = timeValue.getSeconds().toString().padStart(2, '0');
    const milliseconds = timeValue.getMilliseconds().toString().padStart(3, '0');
    
    return `${hours}:${minutes}:${seconds}.${milliseconds}`;
  }
  
  return String(timeValue);
};

// Функция для преобразования времени в секунды (для числовой оси)
const convertTimeToSeconds = (timeValue) => {
  // Если уже число в секундах (относительное время)
  if (typeof timeValue === 'number' && timeValue < 1000000000) {
    return timeValue;
  }
  
  // Если timestamp в секундах
  if (typeof timeValue === 'number' && timeValue > 1000000000) {
    return timeValue;
  }
  
  if (typeof timeValue === 'string') {
  // СНАЧАЛА проверяем полную дату (приоритет!)
  const fullDateMatch = timeValue.match(/\d{4}-\d{2}-\d{2}/);
  if (fullDateMatch) {
    const date = new Date(timeValue);
    if (!isNaN(date.getTime())) {
      return date.getTime() / 1000;
    }
  }
  
  // ПОТОМ проверяем формат HH:MM:SS (только для времени без даты)
  const timeMatch = timeValue.match(/^(\d{1,2}):(\d{1,2}):(\d{1,2})(?:\.(\d+))?$/);
  if (timeMatch) {
    const hours = parseInt(timeMatch[1], 10) || 0;
    const minutes = parseInt(timeMatch[2], 10) || 0;
    const seconds = parseInt(timeMatch[3], 10) || 0;
    
    let milliseconds = 0;
    if (timeMatch[4]) {
      // Правильная обработка миллисекунд
      const msString = timeMatch[4].padEnd(3, '0').substring(0, 3);
      milliseconds = parseInt(msString, 10) / 1000;
    }
    
    return hours * 3600 + minutes * 60 + seconds + milliseconds;
  }
  
  // Иначе пытаемся распарсить как число
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
  // Глобальный шрифт всего текста на канвасе (подписи осей, тултип) — единый
  // чёткий стек, согласованный с радиальным графиком.
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
  // Добавляем настройки для axisPointer на осях
  axisPointer: {
    link: { xAxisIndex: 'all' },
    label: {
      formatter: function(params) {
        // Применяем форматирование времени только для оси X
        if (params.axisDimension === 'x') {
          return formatTimeOnly(params.value);
        }
        // Для оси Y показываем обычное числовое значение
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
        // Форматируем как обычное число с 1 знаком после запятой
        return value.toFixed(1);
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

// Multi-line форматтер тултипа. Определён один раз на уровне модуля,
// чтобы не пересоздавать функцию на каждом обновлении данных.
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

// Форматирование значения легенды (короткое, без лишних нулей).
const formatLegendValue = (v) => {
  if (v === undefined || v === null || isNaN(v)) return '—';
  return parseFloat(Number(v).toFixed(6)).toString();
};

// Боковая легенда линейного графика: список линий (цвет + имя + последнее значение).
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
        <span>Линии</span>
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
}) => {
  const { isDark } = useTheme();
  const chartRef = useRef(null);
  const containerRef = useRef(null); // внешний flex-контейнер (график + легенда)
  const chartInstanceRef = useRef(null);
  const [chartInstance, setChartInstance] = useState(null);
  const currentXRangeRef = useRef(null);
  // Состояние для отслеживания взаимодействия пользователя с графиком
  const [userInteracting, setUserInteracting] = useState(false);
  const userInteractingRef = useRef(false); // Ref для использования в обработчиках событий
  const [, setCurrentXRange] = useState(null); // Диапазон X после зума (значение хранится в currentXRangeRef)
  const prevLinesDataRef = useRef(null);
  const prevSeriesCountRef = useRef(0); // Сколько серий было в прошлый раз (для очистки удалённых линий)

  // ДОБАВИТЬ: Получаем devicePixelRatio для высокого качества
  const dpr = window.devicePixelRatio || 1;

  // Преобразуем данные одной линии в формат ECharts
const formatLineDataForECharts = (data) => {
  if (!data || !Array.isArray(data)) return [];

  // Ограничиваем отображение последними pointLimit точками (настраивается per-график)
  const limit = pointLimit > 0 ? pointLimit : data.length;
  const limitedData = data.length > limit ? data.slice(-limit) : data;
  const formattedData = [];

  limitedData.forEach(item => {
    if (item && typeof item === 'object') {
      // item.time уже содержит числовые секунды (вычислены при приёме данных) —
      // используем их напрямую, не прогоняя regex по каждой точке каждый кадр.
      // Строку (originalTime) парсим только как fallback для старого формата.
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

      // Извлекаем значение
      if (item.value !== undefined) {
        formattedData.push([timeInSeconds, item.value]);
      }
    }
  });

  return formattedData;
};

// Преобразуем все линии в формат ECharts
const formatAllLinesForECharts = (lines) => {
  if (!lines || !Array.isArray(lines) || lines.length === 0) {
    // Fallback на старый формат для обратной совместимости
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
    data: formatLineDataForECharts(line.data || [])
  }));
};

// Диапазон Y по уже отформатированным данным ([timeInSeconds, value]).
// Один проход, без regex и parseFloat — числа уже готовы.
// Используется в горячем пути обновления вместо calculateYRange(lines, ...),
// который заново парсил время по каждой точке.
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

// Диапазон X по отформатированным данным с 10% отступа (для авто-режима).
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

  // Колбэк готовности графика. echarts-for-react создаёт инстанс асинхронно
  // (временный → дожидается 'finished' → пересоздаёт с финальными размерами),
  // поэтому синхронный getEchartsInstance() в useEffect мог вернуть уже
  // уничтоженный временный инстанс. onChartReady вызывается с финальным.
  const handleChartReady = useCallback((instance) => {
    chartInstanceRef.current = instance;
    setChartInstance(instance);
  }, []);

  // Очистка ссылки при размонтировании (сам инстанс диспозит echarts-for-react).
  useEffect(() => {
    return () => {
      chartInstanceRef.current = null;
    };
  }, []);

  // Tooltip и интерактивность зависят от режима автообновления, но не от данных.
  // Ставим отдельным merge-апдейтом, чтобы горячий путь обновления данных
  // не пересобирал tooltip/форматтеры на каждом тике.
  // Во время автообновления полностью блокируем интеракции (тултип + зум/панорама),
  // после остановки — возвращаем. show:true обязательно в ветке «выключено», иначе
  // прежнее show:false не сбрасывается при merge и тултип остаётся скрытым.
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

  // Отслеживание изменений диапазона X при зуме
useEffect(() => {
  if (!chartInstanceRef.current || chartInstanceRef.current.isDisposed()) return;

  const handleDataZoomEvent = (params) => {
  if (params.batch && params.batch.length > 0) {
    const xAxisZoom = params.batch.find(b => b.dataZoomId && b.xAxisIndex !== undefined);
    
    if (xAxisZoom) {
      // Получаем текущий диапазон X
      const option = chartInstance.getOption();
      if (option && option.xAxis && option.xAxis[0]) {
        let newXRange = null;
        
        // Сохраняем текущий диапазон X
        if (xAxisZoom.startValue !== undefined && xAxisZoom.endValue !== undefined) {
          newXRange = {
            min: xAxisZoom.startValue,
            max: xAxisZoom.endValue
          };
        } else if (xAxisZoom.start !== undefined && xAxisZoom.end !== undefined) {
          // Если используются проценты, конвертируем в значения
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
        
        //Обновляем currentXRange и ось Y
        if (newXRange) {
          currentXRangeRef.current = newXRange;
          setCurrentXRange(newXRange);
          // Вычисляем новый диапазон Y для видимых данных (по отформатированным данным)
          const yRange = calcYRangeFromFormatted(
            formatAllLinesForECharts(lines),
            newXRange.min,
            newXRange.max
          );

          // Обновляем только ось Y (merge, без пересоздания)
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
    // ✅ Проверяем при очистке
    if (chartInstanceRef.current && !chartInstanceRef.current.isDisposed()) {
      chartInstanceRef.current.off('dataZoom', handleDataZoomEvent);
    }
  };
}, [chartInstance]);


  // Отслеживание взаимодействия пользователя с графиком
  useEffect(() => {
    if (!chartInstanceRef.current || chartInstanceRef.current.isDisposed()) return;

    // Обработчик события dataZoom (когда пользователь масштабирует или двигает график)
    const handleDataZoom = (params) => {
      // Проверяем, что событие вызвано пользователем, а не программно
      if (params.batch && params.batch.length > 0) {
        const isUserAction = params.batch[0].start !== undefined || params.batch[0].end !== undefined;
        if (isUserAction) {
          userInteractingRef.current = true;
          setUserInteracting(true);
        }
      }
    };

    // Обработчик события restore (когда пользователь сбрасывает zoom)
    const handleRestore = () => {
      userInteractingRef.current = false;
      setUserInteracting(false);
    };

    // Подписываемся на события
    chartInstanceRef.current.on('dataZoom', handleDataZoom);
    chartInstanceRef.current.on('restore', handleRestore);

    // Отписываемся при размонтировании
    return () => {
      // ✅ Проверяем при очистке
      if (chartInstanceRef.current && !chartInstanceRef.current.isDisposed()) {
        chartInstanceRef.current.off('dataZoom', handleDataZoom);
        chartInstanceRef.current.off('restore', handleRestore);
      }
    };
  }, [chartInstance]);

// При смене лимита точек возвращаемся к авто-следованию за данными: сбрасываем
// сохранённый пользовательский зум/диапазон X. Иначе новые данные (другое
// временное окно) могут оказаться вне замороженного диапазона — линия «исчезает»,
// хотя тултип её находит. Объявлено ДО эффекта обновления данных, чтобы тот в том
// же коммите прочитал уже сброшенный userInteractingRef.
useEffect(() => {
  userInteractingRef.current = false;
  setUserInteracting(false);
  currentXRangeRef.current = null;
  setCurrentXRange(null);
}, [pointLimit]);

// При включении автообновления сбрасываем сохранённый пользовательский зум:
// интеракции в этом режиме заблокированы, поэтому график должен следовать за
// данными, а не висеть в замороженном диапазоне прошлого зума. Сбрасываем и
// сигнатуру, чтобы эффект обновления ниже сразу перефитил ось X (а не пропустил
// тик по неизменной сигнатуре). Объявлено ДО эффекта обновления данных.
useEffect(() => {
  if (!isAutoUpdate) return;
  userInteractingRef.current = false;
  setUserInteracting(false);
  currentXRangeRef.current = null;
  setCurrentXRange(null);
  prevLinesDataRef.current = null;
}, [isAutoUpdate]);

// Обновление данных графика.
// Один инкрементальный setOption: меняем только series.data и границы осей.
// Статичная конфигурация (оси, grid, dataZoom, tooltip) выставлена один раз
// и здесь не пересобирается.
useEffect(() => {
  const inst = chartInstanceRef.current;
  if (!inst || inst.isDisposed()) return;

  // Дешёвая сигнатура изменений вместо JSON.stringify всего массива точек.
  // pointLimit входит в сигнатуру, чтобы смена лимита сразу перерисовала
  // уже загруженные данные, а не ждала следующего тика автообновления.
  let sig = `lim:${pointLimit}|`;
  for (let i = 0; i < lines.length; i++) {
    const d = lines[i].data;
    const len = d ? d.length : 0;
    const last = len > 0 ? d[len - 1] : null;
    sig += `${lines[i].id}:${len}:${last ? last.time : ''}|`;
  }
  if (prevLinesDataRef.current === sig) {
    // Данные не изменились — пропускаем обновление
    return;
  }
  prevLinesDataRef.current = sig;

  // Форматируем данные всех линий в [timeInSeconds, value] (один проход с конвертацией времени)
  const formattedLines = formatAllLinesForECharts(lines);

  // Fallback на старый формат chartData
  if (formattedLines.length === 0 && chartData) {
    formattedLines.push({
      name: 'Данные',
      color: '#1f02c3',
      data: formatLineDataForECharts(chartData)
    });
  }
  if (formattedLines.length === 0) return;

  // Когда пользователь взаимодействует с графиком (зум/перемещение) —
  // сохраняем его диапазон X и считаем Y только по видимому окну.
  const interacting = userInteractingRef.current;
  const xRange = interacting ? currentXRangeRef.current : null;

  const yRange = calcYRangeFromFormatted(
    formattedLines,
    xRange?.min ?? null,
    xRange?.max ?? null
  );

  const series = formattedLines.map(line => ({
    name: line.name,
    type: 'line',
    showSymbol: false,
    clip: true,
    connectNulls: false,
    animation: false,
    sampling: 'lttb',
    itemStyle: { color: line.color },
    lineStyle: { color: line.color, width: 2.2 },
    data: line.data
  }));

  // Если линий стало меньше — добиваем массив пустыми сериями, чтобы при merge
  // не остались «призрачные» линии от прошлого обновления (без replaceMerge).
  for (let i = series.length; i < prevSeriesCountRef.current; i++) {
    series.push({ type: 'line', data: [] });
  }
  prevSeriesCountRef.current = formattedLines.length;

  const updateOption = {
    yAxis: { min: yRange.min, max: yRange.max },
    series
  };

  // В авто-режиме (без взаимодействия) ось X следует за данными.
  if (!interacting) {
    const xr = calcXRangeFromFormatted(formattedLines);
    if (xr) {
      updateOption.xAxis = { min: xr.min, max: xr.max };
    }
  }

  try {
    // merge (notMerge=false): меняем только data серий и границы осей,
    // статичная конфигурация (оси, grid, dataZoom, tooltip) не пересобирается.
    inst.setOption(updateOption, false, false);
  } catch (error) {
    console.error('Ошибка обновления графика:', error);
  }
}, [chartData, lines, activeGraphUpdate, chartInstance, pointLimit, isAutoUpdate]);

  // Авто-ширина боковой колонки легенды (~28%, [220,360]px) — стартовое значение;
  // дальше пользователь может менять её, перетаскивая разделитель.
  const totalW = typeof width === 'number' ? width : null;
  const defaultLegendWidth = totalW ? Math.min(360, Math.max(220, Math.round(totalW * 0.28))) : 280;
  const [legendWidth, startLegendResize] = useResizableLegend(containerRef, totalW, defaultLegendWidth);

  // Записи легенды: имя + цвет + последнее значение каждой линии.
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
          // Курсор — crosshair, как в легенде (задаётся в CSS через .chart-canvas-area
          // с !important, чтобы перебить inline-курсор zrender над канвасом).
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
            // Суперсэмплинг как в радиальном графике: рендерим канвас в повышенной
            // плотности пикселей → чёткие линии и подписи осей. Раньше DPR капали
            // ради перфоманса; теперь приоритет — чёткость. Перф-буфер: sampling
            // 'lttb' + animation:false + инкрементальный setOption. Если на слабом
            // железе при большом лимите точек появится лаг — снизить кап до 3.
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