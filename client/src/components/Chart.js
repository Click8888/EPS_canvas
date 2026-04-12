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
    scale: false, // Отключаем автомасштабирование, чтобы 0 всегда был виден
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
  height = '600px',
}) => {
  const chartRef = useRef(null);
  const [option, setOption] = useState(defaultOption);
  const [chartInstance, setChartInstance] = useState(null);
  
  // Состояние для отслеживания взаимодействия пользователя с графиком
  const [userInteracting, setUserInteracting] = useState(false);
  const userInteractingRef = useRef(false); // Ref для использования в обработчиках событий
  

  // Преобразуем данные в формат, понятный ECharts
  const formatDataForECharts = (data) => {
    if (!data || !Array.isArray(data)) return { time: [], values: [] };

    // Ограничиваем отображение до последних 200 точек
    const limitedData = data.length > 300 ? data.slice(-300) : data;

    const time = [];
    const values = [];

    limitedData.forEach(item => {
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

  // Начальная настройка графика
  useEffect(() => {
    if (!chartInstance) return;
    
    // Устанавливаем начальную конфигурацию графика
    chartInstance.setOption(defaultOption, true);
  }, [chartInstance]);

  // Отслеживание взаимодействия пользователя с графиком
  useEffect(() => {
    if (!chartInstance) return;

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
    chartInstance.on('dataZoom', handleDataZoom);
    chartInstance.on('restore', handleRestore);

    // Отписываемся при размонтировании
    return () => {
      chartInstance.off('dataZoom', handleDataZoom);
      chartInstance.off('restore', handleRestore);
    };
  }, [chartInstance]);

  // Обновление данных графика
  useEffect(() => {
    if (!chartInstance || !chartData) return;

    const formattedData = formatDataForECharts(chartData);
    
    // Проверяем, взаимодействует ли пользователь с графиком
    if (userInteractingRef.current) {
      // РЕЖИМ 1: Пользователь взаимодействует - обновляем ТОЛЬКО данные
      const updateOption = {
        series: [
          {
            data: formattedData.values.map((value, index) => [formattedData.time[index], value])
          }
        ]
      };
      
      // notMerge: false сохраняет состояние zoom/pan
      chartInstance.setOption(updateOption, false);
      
    } else {
      // РЕЖИМ 2: Пользователь НЕ взаимодействует - обновляем данные И оси
      const newOption = {
        xAxis: {
          ...defaultOption.xAxis,
          data: formattedData.time,
          min: function(value) {
            const range = value.max - value.min;
            return value.min - range * 0.1; // 10% отступ слева
          },
          max: function(value) {
            const range = value.max - value.min;
            return value.max + range * 0.1; // 10% отступ справа
          },
          axisLabel: {
            ...defaultOption.xAxis.axisLabel,
            interval: 1
          }
        },
        yAxis: {
          ...defaultOption.yAxis,
          min: function(value) {
            const range = value.max - value.min;
            const minWithPadding = value.min - range * 0.1;
            return Math.min(minWithPadding, 0);
          },
          max: function(value) {
            const range = value.max - value.min;
            const maxWithPadding = value.max + range * 0.1;
            return Math.max(maxWithPadding, 0);
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
      
      // Обновляем состояние option для ReactECharts
      setOption(newOption);
      
      // notMerge: false для плавного обновления
      chartInstance.setOption(newOption, false);
    }

  }, [chartData, activeGraphUpdate, chartInstance]);

  return (
    <div
      id="graph"
      style={{ 
        width: width, 
        height: height,
        position: 'relative'
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
      
      {/* Кнопка сброса zoom - показывается только когда пользователь взаимодействовал */}
      {userInteracting && (
        <button
          onClick={() => {
            if (chartInstance) {
              // Сбрасываем zoom и возвращаемся к автоматическому режиму
              chartInstance.dispatchAction({ type: 'restore' });
              userInteractingRef.current = false;
              setUserInteracting(false);
            }
          }}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            padding: '8px 16px',
            backgroundColor: '#4dabf7',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '500',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            zIndex: 1000,
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#339af0'}
          onMouseLeave={(e) => e.target.style.backgroundColor = '#4dabf7'}
        >
          Сбросить масштаб
        </button>
      )}
    </div>
  );
};

export default Chart;