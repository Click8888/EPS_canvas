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
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'cross' },
    formatter: function(params) {
      if (!params || params.length === 0) return '';
      const timeValue = params[0].value[0];
      const formattedTime = formatTimeOnly(timeValue);
      const value = params[0].value[1];
      return `Время: ${formattedTime}<br/>Значение: ${value.toFixed(2)}`;
    }
  },
  // Добавляем настройки для axisPointer на осях
  axisPointer: {
    link: { xAxisIndex: 'all' },
    label: {
      formatter: function(params) {
        // params.value - это значение на оси X в секундах
        return formatTimeOnly(params.value);
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
  const [currentXRange, setCurrentXRange] = useState(null); // Текущий диапазон X после зума 

  // ДОБАВИТЬ: Получаем devicePixelRatio для высокого качества
  const dpr = window.devicePixelRatio || 1;

  // Преобразуем данные в формат, понятный ECharts
  const formatDataForECharts = (data) => {
    if (!data || !Array.isArray(data)) return { time: [], values: [] };

    // Ограничиваем отображение до последних 200 точек
    const limitedData = data.length > 1000 ? data.slice(-1000) : data;

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

  // Функция для расчета диапазона Y на основе видимых данных X
const calculateYRange = (data, xMin, xMax) => {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return { min: 0, max: 100 };
  }

  let minY = Infinity;
  let maxY = -Infinity;

if (xMin !== null && xMax !== null) {
  // Только видимые данные в диапазоне X
  data.forEach(item => {
    if (item && typeof item === 'object') {
      let timeValue;
      
      if (item.originalTime !== undefined) {
        timeValue = item.originalTime;
      } else if (item.time !== undefined) {
        timeValue = item.time;
      } else {
        return;
      }
      
      const timeInSeconds = convertTimeToSeconds(timeValue);
      
      // Проверяем, попадает ли точка в видимый диапазон X
      if (timeInSeconds >= xMin && timeInSeconds <= xMax) {
        const value = parseFloat(item.value);
        if (!isNaN(value)) {
          minY = Math.min(minY, value);
          maxY = Math.max(maxY, value);
        }
      }
    }
  });
} else {
  // Fallback: все данные (когда диапазон X не определен)
  data.forEach(item => {
    if (item && typeof item === 'object' && item.value !== undefined) {
      const value = parseFloat(item.value);
      if (!isNaN(value)) {
        minY = Math.min(minY, value);
        maxY = Math.max(maxY, value);
      }
    }
  });
}

  // Если не нашли данных
  if (minY === Infinity || maxY === -Infinity) {
    return { min: 0, max: 100 };
  }

  // Добавляем 20% отступа сверху и снизу
  const range = maxY - minY || 1;
  const padding = range * 0.2;
  
  return {
    min: minY - padding,
    max: maxY + padding
  };
};


  // Инициализация экземпляра графика
useEffect(() => {
  if (chartRef.current && !chartInstance) {
    try {
      const instance = chartRef.current.getEchartsInstance();
      if (instance) {
        setChartInstance(instance);
        instance.resize();
      }
    } catch (error) {
      console.error('Ошибка инициализации графика:', error);
    }
  }

  // Очистка при размонтировании
  return () => {
    if (chartInstance && typeof chartInstance.dispose === 'function') {
      try {
        chartInstance.dispose();
      } catch (error) {
        console.error('Ошибка при очистке графика:', error);
      }
    }
  };
}, [chartInstance]);

  // Начальная настройка графика
  useEffect(() => {
    if (!chartInstance) return;
    
    // Устанавливаем начальную конфигурацию графика
    chartInstance.setOption(defaultOption, true);
  }, [chartInstance]);

  // Отслеживание изменений диапазона X при зуме
useEffect(() => {
  if (!chartInstance) return;

  const handleDataZoomEvent = (params) => {
    if (params.batch && params.batch.length > 0) {
      const xAxisZoom = params.batch.find(b => b.dataZoomId && b.xAxisIndex !== undefined);
      
      if (xAxisZoom) {
        // Получаем текущий диапазон X
        const option = chartInstance.getOption();
        if (option && option.xAxis && option.xAxis[0]) {
          const xAxis = option.xAxis[0];
          const xData = xAxis.data || [];
          
          // Сохраняем текущий диапазон X
          if (xAxisZoom.startValue !== undefined && xAxisZoom.endValue !== undefined) {
            setCurrentXRange({
              min: xAxisZoom.startValue,
              max: xAxisZoom.endValue
            });
          } else if (xAxisZoom.start !== undefined && xAxisZoom.end !== undefined) {
            // Если используются проценты, конвертируем в значения
            const allData = chartInstance.getOption().series[0].data || [];
            if (allData.length > 0) {
              const startIdx = Math.floor((xAxisZoom.start / 100) * allData.length);
              const endIdx = Math.ceil((xAxisZoom.end / 100) * allData.length);
              
              if (allData[startIdx] && allData[endIdx - 1]) {
                setCurrentXRange({
                  min: allData[startIdx][0],
                  max: allData[endIdx - 1][0]
                });
              }
            }
          }
        }
      }
    }
  };

  chartInstance.on('dataZoom', handleDataZoomEvent);

  return () => {
    chartInstance.off('dataZoom', handleDataZoomEvent);
  };
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
    // 1: Пользователь взаимодействует - обновляем ТОЛЬКО данные
    const updateOption = {
      animation: false,
      series: [
        {
          animation: false,
          data: formattedData.values.map((value, index) => [formattedData.time[index], value])
        }
      ]
    };
    
    if (chartInstance && typeof chartInstance.setOption === 'function') {
      try {
        chartInstance.setOption(updateOption, false, false);
      } catch (error) {
        console.error('Ошибка обновления графика:', error);
      }
    }
    
  } else {
    // РЕЖИМ 2: Пользователь НЕ взаимодействует - обновляем данные И оси
    const newOption = {
      animation: false,
      xAxis: {
        ...defaultOption.xAxis,
        animation: false,
        data: formattedData.time,
        min: function(value) {
          const range = value.max - value.min;
          return value.min - range * 0.1;
        },
        max: function(value) {
          const range = value.max - value.min;
          return value.max + range * 0.1;
        },
        axisLabel: {
          ...defaultOption.xAxis.axisLabel,
          interval: 'auto',
          hideOverlap: true
        }
      },
      yAxis: {
        ...defaultOption.yAxis,
        animation: false,
        min: function(value) {
          // Используем calculateYRange для определения диапазона
          const yRange = calculateYRange(
            chartData, 
            currentXRange?.min || null, 
            currentXRange?.max || null, 
          );
          return yRange.min;
        },
        max: function(value) {
          const yRange = calculateYRange(
            chartData, 
            currentXRange?.min || null, 
            currentXRange?.max || null, 
          );
          return yRange.max;
        }
      },
      series: [
        {
          ...defaultOption.series[0],
          animation: false,
          data: formattedData.values.map((value, index) => [formattedData.time[index], value]),
          name: 'Точка'
        }
      ]
    };
    
    setOption(newOption);
    
    if (chartInstance && typeof chartInstance.setOption === 'function') {
      try {
        chartInstance.setOption(newOption, false, false);
      } catch (error) {
        console.error('Ошибка обновления графика:', error);
      }
    }
  }

}, [chartData, activeGraphUpdate, chartInstance, currentXRange]);

  return (
    <div
      id="graph"
      style={{ 
        width: width, 
        height: height,
        position: 'relative',
        cursor: 'grab' // Курсор "рука" для перемещения
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
        opts={{ 
          renderer: 'canvas',
          devicePixelRatio: dpr * 2  // Качество рендера при варианте canvas (можно ещё использовать svg, но она добавляет разрешения только осям)
        }}
      />
      
      {/* Кнопка сброса zoom - показывается только когда пользователь взаимодействовал */}
      {userInteracting && (
  <button
    onClick={() => {
      if (chartInstance && typeof chartInstance.dispatchAction === 'function') {
        try {
          // Сбрасываем zoom и возвращаемся к автоматическому режиму
          chartInstance.dispatchAction({ type: 'restore' });
          userInteractingRef.current = false;
          // Сбрасываем сохраненный диапазон X
          setCurrentXRange(null);
          setUserInteracting(false);
        } catch (error) {
          console.error('Ошибка сброса масштаба:', error);
        }
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
