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

// Инициализируем ECharts один раз
echarts.use([
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LineChart,
  CanvasRenderer,
  UniversalTransition
]);

// Функция для форматирования времени в формат ЧЧ:ММ:СС.мс
const formatTime = (timeValue) => {
  if (timeValue === undefined || timeValue === null) return '';
  
  // Если время в секундах (число)
  if (typeof timeValue === 'number' && timeValue < 1000000000) {
    const hours = Math.floor(timeValue / 3600);
    const minutes = Math.floor((timeValue % 3600) / 60);
    const seconds = Math.floor(timeValue % 60);
    const milliseconds = Math.floor((timeValue % 1) * 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  }
  
  // Если время в миллисекундах (timestamp)
  if (typeof timeValue === 'number' && timeValue > 1000000000) {
    const date = new Date(timeValue);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();
    const milliseconds = date.getMilliseconds();
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  }
  
  // Если время в виде строки
  if (typeof timeValue === 'string') {
    // Пробуем распарсить строку времени
    const timeMatch = timeValue.match(/(\d{1,2}):(\d{1,2}):(\d{1,2})(?:\.(\d+))?/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1]) || 0;
      const minutes = parseInt(timeMatch[2]) || 0;
      const seconds = parseInt(timeMatch[3]) || 0;
      const milliseconds = timeMatch[4] ? parseInt(timeMatch[4].substring(0, 3)) : 0;
      
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
    }
    
    // Пробуем преобразовать в Date
    const date = new Date(timeValue);
    if (!isNaN(date.getTime())) {
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const seconds = date.getSeconds();
      const milliseconds = date.getMilliseconds();
      
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
    }
  }
  
  // Если это объект Date
  if (timeValue instanceof Date) {
    const hours = timeValue.getHours();
    const minutes = timeValue.getMinutes();
    const seconds = timeValue.getSeconds();
    const milliseconds = timeValue.getMilliseconds();
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  }
  
  return String(timeValue);
};

// Функция для форматирования относительного времени (от 0:00:00.000)
const formatRelativeTime = (timeValue, referenceTime) => {
  if (timeValue === undefined || timeValue === null) return '';
  if (referenceTime === null) return '0:00:00.000';
  
  // Вычисляем относительное время в секундах
  const relativeSeconds = timeValue - referenceTime;
  
  // Если относительное время отрицательное, показываем 0
  if (relativeSeconds < 0) return '0:00:00.000';
  
  const hours = Math.floor(relativeSeconds / 3600);
  const minutes = Math.floor((relativeSeconds % 3600) / 60);
  const seconds = Math.floor(relativeSeconds % 60);
  const milliseconds = Math.floor((relativeSeconds % 1) * 1000);
  
  // Всегда показываем формат с часами
  return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
};

// Функция для получения абсолютного времени в читаемом формате
const getAbsoluteTimeString = (timeValue) => {
  if (timeValue === undefined || timeValue === null) return '';
  
  // Используем существующую функцию formatTime для абсолютного времени
  return formatTime(timeValue);
};

// Функция для преобразования времени в секунды (для числовой оси)
const convertTimeToSeconds = (timeValue) => {
  if (typeof timeValue === 'number' && timeValue < 1000000000) {
    return timeValue;
  }
  
  if (typeof timeValue === 'number' && timeValue > 1000000000) {
    return timeValue / 1000;
  }
  
  if (typeof timeValue === 'string') {
    const timeMatch = timeValue.match(/(\d{1,2}):(\d{1,2}):(\d{1,2})(?:\.(\d+))?/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1]) || 0;
      const minutes = parseInt(timeMatch[2]) || 0;
      const seconds = parseInt(timeMatch[3]) || 0;
      const milliseconds = timeMatch[4] ? parseInt(timeMatch[4].substring(0, 3)) / 1000 : 0;
      return hours * 3600 + minutes * 60 + seconds + milliseconds;
    }
  }
  
  if (timeValue instanceof Date) {
    return timeValue.getHours() * 3600 + timeValue.getMinutes() * 60 + timeValue.getSeconds() + timeValue.getMilliseconds() / 1000;
  }
  
  return 0;
};

const defaultOption = {
  animation: false,
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'cross' },
    formatter: function(params) {
      if (!params || params.length === 0) return '';
      const timeValue = params[0].value[0];
      const formattedTime = formatTime(timeValue);
      const value = params[0].value[1];
      return `Время: ${formattedTime}<br/>Значение: ${value}`;
    }
  },
  axisPointer: {
    link: { xAxisIndex: 'all' },
    label: {
      formatter: function(params) {
        return formatTime(params.value);
      }
    }
  },
  grid: {
    top: 40,
    left: 50,
    right: 40,
    bottom: 50
  },
  xAxis: {
    name: 'время',
    type: 'value',
    nameLocation: 'middle',
    nameGap: 35,
    min: 0,
    max: 100,
    axisLabel: {
      formatter: function(value) {
        return formatTime(value);
      },
      rotate: 0
    },
    minorTick: {
      show: true
    },
    minorSplitLine: {
      show: true
    },
    splitLine: {
      show: true
    },
    axisTick: {
      show: true
    }
  },
  yAxis: {
    name: 'значение',
    type: 'value',
    min: 0,
    max: 100,
    minorTick: {
      show: true
    },
    minorSplitLine: {
      show: false
    },
    splitLine: {
      show: false
    }
  },
  dataZoom: [
    {
      show: true,
      type: 'inside',
      filterMode: 'none',
      xAxisIndex: [0]
    },
    {
      show: true,
      type: 'inside',
      filterMode: 'none',
      yAxisIndex: [0]
    }
  ],
  series: [
    {
      name: 'Данные',
      type: 'line',
      showSymbol: false,
      clip: true,
      itemStyle: {
        color: '#4dabf7'
      },
      data: []
    }
  ]
};

const Chart = ({ 
  activeGraphUpdate,
  chartData, 
  width = '100%', 
  height = '600px',
  onAutoScaleReady,
  onResetReady,
  onAbsoluteTimeUpdate  // Новый prop для передачи абсолютного времени
}) => {
  const chartRef = useRef(null);
  const [option, setOption] = useState(defaultOption);
  const [chartInstance, setChartInstance] = useState(null);
  const [axesInitialized, setAxesInitialized] = useState(false);
const [axisBounds, setAxisBounds] = useState({
  minX: 0,
  maxX: 100,
  minY: 0,
  maxY: 100
});
const [referenceTime, setReferenceTime] = useState(null);
const [absoluteStartTime, setAbsoluteStartTime] = useState(null); // Для отображения абсолютного времени

  const checkAndExpandBounds = useCallback((formattedData) => {
  if (formattedData.time.length === 0 || formattedData.values.length === 0) {
    return axisBounds;
  }

  const dataMinX = Math.min(...formattedData.time);
  const dataMaxX = Math.max(...formattedData.time);
  const dataMinY = Math.min(...formattedData.values);
  const dataMaxY = Math.max(...formattedData.values);

  let needsUpdate = false;
  let newBounds = { ...axisBounds };

  // Проверяем выход за границы по X
  if (dataMinX < axisBounds.minX || dataMaxX > axisBounds.maxX) {
    const currentRangeX = axisBounds.maxX - axisBounds.minX;
    const centerX = (axisBounds.minX + axisBounds.maxX) / 2;
    const newRangeX = currentRangeX * 2; // Удваиваем диапазон
    newBounds.minX = centerX - newRangeX / 2;
    newBounds.maxX = centerX + newRangeX / 2;
    needsUpdate = true;
  }

  // Проверяем выход за границы по Y
  if (dataMinY < axisBounds.minY || dataMaxY > axisBounds.maxY) {
    const currentRangeY = axisBounds.maxY - axisBounds.minY;
    const centerY = (axisBounds.minY + axisBounds.maxY) / 2;
    const newRangeY = currentRangeY * 2; // Удваиваем диапазон
    newBounds.minY = centerY - newRangeY / 2;
    newBounds.maxY = centerY + newRangeY / 2;
    needsUpdate = true;
  }

  return needsUpdate ? newBounds : null;
}, [axisBounds]);


const autoScale = useCallback(() => {
  if (!chartInstance || !chartData || chartData.length === 0 || referenceTime === null) return;

  const formattedData = formatDataForECharts(chartData);
  
  if (formattedData.time.length === 0 || formattedData.values.length === 0) return;

  const minTime = Math.min(...formattedData.time);
  const maxTime = Math.max(...formattedData.time);
  const minValue = Math.min(...formattedData.values);
  const maxValue = Math.max(...formattedData.values);

  const timeRange = maxTime - minTime || 1;
  const valueRange = maxValue - minValue || 1;

  // Границы в АБСОЛЮТНЫХ значениях
  const newBounds = {
    minX: minTime,
    maxX: maxTime + timeRange * 0.05,
    minY: minValue - valueRange * 0.1,
    maxY: maxValue + valueRange * 0.1
  };

  setAxisBounds(newBounds);

  // НЕ ОБНОВЛЯЕМ referenceTime - он остается неизменным!
  // Обновляем только границы осей в ОТНОСИТЕЛЬНЫХ координатах
  chartInstance.setOption({
    xAxis: { 
      min: newBounds.minX - referenceTime,  // ОТНОСИТЕЛЬНОЕ
      max: newBounds.maxX - referenceTime   // ОТНОСИТЕЛЬНОЕ
    },
    yAxis: { 
      min: newBounds.minY, 
      max: newBounds.maxY 
    }
  }, { notMerge: false });

}, [chartInstance, chartData, referenceTime]);

// Функция для создания опций графика с учетом referenceTime
const createChartOption = useCallback((refTime) => {
  return {
    animation: false,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      formatter: function(params) {
        if (!params || params.length === 0) return '';
        const timeValue = params[0].value[0];
        const relativeTime = formatRelativeTime(timeValue, refTime);
        const value = params[0].value[1];
        
        // Показываем и относительное, и абсолютное время
        let tooltipText = `Относительное время: ${relativeTime}<br/>`;
        if (refTime !== null) {
          const absoluteTime = getAbsoluteTimeString(timeValue);
          tooltipText += `Абсолютное время: ${absoluteTime}<br/>`;
        }
        tooltipText += `Значение: ${value}`;
        
        return tooltipText;
      }
    },
    axisPointer: {
      link: { xAxisIndex: 'all' },
      label: {
        formatter: function(params) {
          return formatRelativeTime(params.value, refTime);
        }
      }
    },
    grid: {
      top: 40,
      left: 50,
      right: 40,
      bottom: 50
    },
    xAxis: {
      name: 'время (относительное)',
      type: 'value',
      nameLocation: 'middle',
      nameGap: 35,
      min: 0,
      max: 100,
      axisLabel: {
        formatter: function(value) {
          return formatRelativeTime(value, refTime);
        },
        rotate: 0
      },
      minorTick: {
        show: true
      },
      minorSplitLine: {
        show: true
      },
      splitLine: {
        show: true
      },
      axisTick: {
        show: true
      }
    },
    yAxis: {
      name: 'значение',
      type: 'value',
      min: 0,
      max: 100,
      minorTick: {
        show: true
      },
      minorSplitLine: {
        show: true
      },
      splitLine: {
        show: true
      }
    },
    dataZoom: [
      {
        show: true,
        type: 'inside',
        filterMode: 'none',
        xAxisIndex: [0]
      },
      {
        show: true,
        type: 'inside',
        filterMode: 'none',
        yAxisIndex: [0]
      }
    ],
    series: [
      {
        name: 'Данные',
        type: 'line',
        showSymbol: false,
        clip: true,
        itemStyle: {
          color: '#4dabf7'
        },
        data: []
      }
    ]
  };
}, []);

// Функция для полного сброса графика
const resetChart = useCallback(() => {
  setReferenceTime(null);
  setAbsoluteStartTime(null);
  setAxesInitialized(false);
  setAxisBounds({
    minX: 0,
    maxX: 100,
    minY: 0,
    maxY: 100
  });
  
  if (chartInstance) {
    const defaultChartOption = createChartOption(null);
    chartInstance.setOption(defaultChartOption, { notMerge: true });
  }
}, [chartInstance, createChartOption]);

  // Преобразуем данные в формат, понятный ECharts
  const formatDataForECharts = (data) => {
    if (!data || !Array.isArray(data)) return { time: [], values: [] };

    const time = [];
    const values = [];

    data.forEach(item => {
      if (item && typeof item === 'object') {
        let timeValue;
        
        // Извлекаем время
        if (item.originalTime !== undefined) {
          timeValue = item.originalTime;
        } else if (item.time !== undefined) {
          timeValue = item.time;
        } else {
          return;
        }
        
        // Преобразуем время в секунды для числовой оси
        const timeInSeconds = convertTimeToSeconds(timeValue);
        time.push(timeInSeconds);
        
        // Извлекаем значение
        if (item.value !== undefined) {
          values.push(item.value);
        }
      }
    });

    return { time, values };
  };

  

// Передаем функции родительскому компоненту
useEffect(() => {
  if (onAutoScaleReady && autoScale) {
    onAutoScaleReady(autoScale);
  }
}, [onAutoScaleReady, autoScale]);

useEffect(() => {
  if (onResetReady && resetChart) {
    onResetReady(resetChart);
  }
}, [onResetReady, resetChart]);

// Передаем абсолютное время первой точки родителю
useEffect(() => {
  if (onAbsoluteTimeUpdate && absoluteStartTime) {
    onAbsoluteTimeUpdate(absoluteStartTime);
  }
}, [onAbsoluteTimeUpdate, absoluteStartTime]);

// Обновление опций графика при изменении referenceTime
useEffect(() => {
  if (!chartInstance) return;

  const chartOption = createChartOption(referenceTime);
  
  chartInstance.setOption(chartOption, { notMerge: false });
}, [chartInstance, referenceTime, createChartOption]);

  // Инициализация экземпляра графика
  useEffect(() => {
    if (chartRef.current && !chartInstance) {
      const instance = chartRef.current.getEchartsInstance();
      setChartInstance(instance);
      instance.resize();
    }

    // Очистка при размонтировании
    return () => {
      if (chartInstance) {
        chartInstance.dispose();
      }
    };
  }, [chartInstance]);


  // Инициализация границ осей при первой загрузке данных
useEffect(() => {
  if (!chartInstance || axesInitialized || !chartData || chartData.length === 0) return;

  const formattedData = formatDataForECharts(chartData);
  
  if (formattedData.time.length === 0 || formattedData.values.length === 0) return;

  // Устанавливаем базовое время как время первой точки (ОДИН РАЗ)
  const firstTime = Math.min(...formattedData.time);
  setReferenceTime(firstTime);
  
  // Сохраняем абсолютное время первой точки для отображения
  const absoluteTime = getAbsoluteTimeString(firstTime);
  setAbsoluteStartTime(absoluteTime);

  const minTime = Math.min(...formattedData.time);
  const maxTime = Math.max(...formattedData.time);
  const minValue = Math.min(...formattedData.values);
  const maxValue = Math.max(...formattedData.values);

  const timeRange = maxTime - minTime || 1;
  const valueRange = maxValue - minValue || 1;

  // Границы осей в АБСОЛЮТНЫХ значениях (не относительных)
  const newBounds = {
    minX: minTime,  // Начинаем от первой точки (абсолютное значение)
    maxX: maxTime + timeRange * 0.05,
    minY: minValue - valueRange * 0.1,
    maxY: maxValue + valueRange * 0.1
  };

  setAxisBounds(newBounds);

  // Создаем опции графика с referenceTime
  const chartOption = createChartOption(firstTime);
  
  chartInstance.setOption({
    ...chartOption,
    xAxis: { 
      ...chartOption.xAxis,
      min: minTime - firstTime,  // ОТНОСИТЕЛЬНОЕ значение для оси
      max: (maxTime + timeRange * 0.05) - firstTime  // ОТНОСИТЕЛЬНОЕ значение
    },
    yAxis: { 
      min: newBounds.minY, 
      max: newBounds.maxY 
    }
  }, { notMerge: false });

  setAxesInitialized(true);
}, [chartInstance, chartData, axesInitialized, createChartOption]);

// Проверка и расширение границ осей при выходе данных за пределы
useEffect(() => {
  if (!chartInstance || !axesInitialized || !chartData || chartData.length === 0 || referenceTime === null) return;

  const formattedData = formatDataForECharts(chartData);
  const newBounds = checkAndExpandBounds(formattedData);

  if (newBounds) {
    setAxisBounds(newBounds);
    
    // Обновляем оси с ОТНОСИТЕЛЬНЫМИ значениями
    chartInstance.setOption({
      xAxis: { 
        min: newBounds.minX - referenceTime,  // ОТНОСИТЕЛЬНОЕ
        max: newBounds.maxX - referenceTime   // ОТНОСИТЕЛЬНОЕ
      },
      yAxis: { 
        min: newBounds.minY, 
        max: newBounds.maxY 
      }
    }, { notMerge: false });
  }
}, [chartInstance, chartData, axesInitialized, checkAndExpandBounds, referenceTime]);

// Обновление только данных серии (без изменения осей)
useEffect(() => {
  if (!chartInstance || referenceTime === null) return;

  const formattedData = formatDataForECharts(chartData || []);

  // Преобразуем данные в относительные координаты
  const relativeData = formattedData.values.map((value, index) => [
    formattedData.time[index] - referenceTime,  // ОТНОСИТЕЛЬНОЕ время
    value
  ]);

  chartInstance.setOption({
    series: [
      {
        data: relativeData
      }
    ]
  }, { 
    notMerge: false,
    replaceMerge: ['series']
  });

}, [chartInstance, chartData, referenceTime]);
    

  return (
    <div
      id="graph"
      style={{ 
        width: width, 
        height: height,
      }}
    >
      <ReactECharts
        ref={chartRef}
        option={option}
        notMerge={false}
        lazyUpdate={true}
        autoResize
        style={{ 
        width: width, 
        height: height,
        minHeight: '300px'
      }}
        opts={{ renderer: 'canvas' }}
      />
    </div>
  );
};

export default Chart;