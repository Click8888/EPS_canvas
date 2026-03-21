import React, { useEffect, useRef, useState } from 'react';
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
  animation: true,
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
  // Добавляем настройки для axisPointer на осях
  axisPointer: {
    link: { xAxisIndex: 'all' },
    label: {
      formatter: function(params) {
        // params.value - это значение на оси X в секундах
        return formatTime(params.value);
      }
    }
  },
  xAxis: {
    type: 'value',
    nameLocation: 'middle',
    nameGap: 35,
    axisLabel: {
      formatter: function(value) {
        return formatTime(value);
      },
      rotate: 0,
      interval: 1
    },
    minInterval: 1,
    splitLine: {
      show: false //Линии от оси
    },
    axisTick: {
      show: true
    }
  },
  yAxis: {
    type: 'value',
    minorTick: {
      show: true
    },
    splitLine: {
      show: true //Линии от оси
    },
  },
  dataZoom: [
    {
      show: true,
      type: 'inside',
      filterMode: 'none',
      xAxisIndex: [0],
    },
    {
      show: true,
      type: 'inside',
      filterMode: 'none',
      yAxisIndex: [0],
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
  ],
  grid: {
    left: '3%',
    right: '4%',
    bottom: '5%',
    top: '10%',
    containLabel: true
  }
};

const Chart = ({ 
  activeGraphUpdate,
  chartData, 
  width = '100%', 
  height = '400px' 
}) => {
  const chartRef = useRef(null);
  const [option, setOption] = useState(defaultOption);
  const [chartInstance, setChartInstance] = useState(null);

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

  // Обновление данных графика
  useEffect(() => {
    if (!chartInstance || !chartData) return;

    const formattedData = formatDataForECharts(chartData);
    
    const newOption = {
      ...defaultOption,
      xAxis: {
        ...defaultOption.xAxis,
        data: formattedData.time,
        min: formattedData.time.length > 0 ? Math.min(...formattedData.time) : undefined,
        max: formattedData.time.length > 0 ? Math.max(...formattedData.time) : undefined,
        axisLabel: {
          ...defaultOption.xAxis.axisLabel,
          interval: 1
        }
      },
      series: [
        {
          ...defaultOption.series[0],
          data: formattedData.values.map((value, index) => [formattedData.time[index], value]),
          name: 'Точка'
        }
      ]
    };
    
    setOption(newOption);
    
    // Обновляем график с анимацией
    chartInstance.setOption(newOption, true);

  }, [chartData, activeGraphUpdate, chartInstance]);

  return (
    <div
      id="graph"
      style={{ 
        width: width, 
        height: height,
        minHeight: '720px',
        minWidth: '400px'
      }}
    >
      <ReactECharts
        ref={chartRef}
        option={option}
        notMerge={true}
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