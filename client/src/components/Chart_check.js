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

const Chart = ({ 
  activeGraphUpdate,
  chartData, 
  lines = [],
  width = '100%', 
  height = '600px',
  isAutoUpdate = false,
}) => {
  const chartRef = useRef(null);
  const [option, setOption] = useState(defaultOption);
  const chartInstanceRef = useRef(null);
  const [chartInstance, setChartInstance] = useState(null);
  const currentXRangeRef = useRef(null);
  // Состояние для отслеживания взаимодействия пользователя с графиком
  const [userInteracting, setUserInteracting] = useState(false);
  const userInteractingRef = useRef(false); // Ref для использования в обработчиках событий
  const [currentXRange, setCurrentXRange] = useState(null); // Текущий диапазон X после зума 
  const prevLinesDataRef = useRef(null);

  // ДОБАВИТЬ: Получаем devicePixelRatio для высокого качества
  const dpr = window.devicePixelRatio || 1;

  // Преобразуем данные одной линии в формат ECharts
const formatLineDataForECharts = (data) => {
  if (!data || !Array.isArray(data)) return [];

  // Ограничиваем отображение до последних 200 точек
  const limitedData = data.length > 200 ? data.slice(-200) : data;
  const formattedData = [];

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

// Функция для расчета диапазона Y на основе видимых данных X для всех линий
const calculateYRange = (lines, xMin, xMax) => {
  // Fallback на старый формат для обратной совместимости
  if (!lines || !Array.isArray(lines) || lines.length === 0) {
    if (chartData && Array.isArray(chartData)) {
      return calculateYRangeForSingleLine(chartData, xMin, xMax);
    }
    return { min: 0, max: 100 };
  }

  let minY = Infinity;
  let maxY = -Infinity;

  // Проходим по всем линиям
  lines.forEach(line => {
    if (!line.data || !Array.isArray(line.data)) return;
    
    line.data.forEach(item => {
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
        if (xMin !== null && xMax !== null) {
          if (timeInSeconds >= xMin && timeInSeconds <= xMax) {
            const value = parseFloat(item.value);
            if (!isNaN(value)) {
              minY = Math.min(minY, value);
              maxY = Math.max(maxY, value);
            }
          }
        } else {
          // Если диапазон X не определен, берем все данные
          const value = parseFloat(item.value);
          if (!isNaN(value)) {
            minY = Math.min(minY, value);
            maxY = Math.max(maxY, value);
          }
        }
      }
    });
  });

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

// Вспомогательная функция для одной линии (для обратной совместимости)
const calculateYRangeForSingleLine = (data, xMin, xMax) => {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return { min: 0, max: 100 };
  }

  let minY = Infinity;
  let maxY = -Infinity;

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
      
      if (xMin !== null && xMax !== null) {
        if (timeInSeconds >= xMin && timeInSeconds <= xMax) {
          const value = parseFloat(item.value);
          if (!isNaN(value)) {
            minY = Math.min(minY, value);
            maxY = Math.max(maxY, value);
          }
        }
      } else {
        const value = parseFloat(item.value);
        if (!isNaN(value)) {
          minY = Math.min(minY, value);
          maxY = Math.max(maxY, value);
        }
      }
    }
  });

  if (minY === Infinity || maxY === -Infinity) {
    return { min: 0, max: 100 };
  }

  const range = maxY - minY || 1;
  const padding = range * 0.2;
  
  return {
    min: minY - padding,
    max: maxY + padding
  };
};

  // Инициализация экземпляра графика
useEffect(() => {
  if (chartRef.current) {
    try {
      const instance = chartRef.current.getEchartsInstance();
      if (instance && !instance.isDisposed()) {
        chartInstanceRef.current = instance; // ✅ Сохраняем в ref
        setChartInstance(instance);
      }
    } catch (error) {
      console.error('Ошибка инициализации графика:', error);
    }
  }

  // ✅ Правильная очистка при размонтировании
  return () => {
    if (chartInstanceRef.current && !chartInstanceRef.current.isDisposed()) {
      chartInstanceRef.current.dispose(); // ✅ Явно уничтожаем экземпляр
    }
    chartInstanceRef.current = null;
    setChartInstance(null);
  };
}, []);

  // Начальная настройка графика ..........
useEffect(() => {
    // ✅ Используем ref и проверяем isDisposed
    if (chartInstanceRef.current && !chartInstanceRef.current.isDisposed()) {
      chartInstanceRef.current.setOption(defaultOption, true);
    }
  }, [chartInstance]);

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
          // Вычисляем новый диапазон Y для видимых данных
          const yRange = calculateYRange(
            lines.length > 0 ? lines : null,
            newXRange.min,
            newXRange.max
          );
          
          // Обновляем только ось Y
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

// Обновление данных графика
useEffect(() => {
  if (!chartInstanceRef.current) return; //vvvv

  // Проверяем, действительно ли изменились данные в линиях
  const currentLinesData = JSON.stringify(lines.map(l => ({
    id: l.id,
    dataLength: l.data?.length,
    lastPoint: l.data?.length > 0 ? l.data[l.data.length - 1] : null
  })));
  
  if (prevLinesDataRef.current === currentLinesData) {
    // Данные не изменились, пропускаем обновление
    return;
  }
  prevLinesDataRef.current = currentLinesData;

  // Форматируем данные всех линий
  const formattedLines = formatAllLinesForECharts(lines);
  
  // Если нет линий, пробуем использовать старый формат chartData
  if (formattedLines.length === 0 && chartData) {
    const fallbackLine = {
      name: 'Данные',
      color: '#1f02c3',
      data: formatLineDataForECharts(chartData)
    };
    formattedLines.push(fallbackLine);
  }
  
  // Если все еще нет данных, выходим
  if (formattedLines.length === 0) return;
  
  // Проверяем, взаимодействует ли пользователь с графиком
  if (userInteractingRef.current) {
  // РЕЖИМ 1: Пользователь взаимодействует - обновляем данные И ось Y
  
  // Вычисляем диапазон Y для текущего видимого диапазона X
  const yRange = calculateYRange(
    lines.length > 0 ? lines : null,
    currentXRangeRef.current?.min || null,
    currentXRangeRef.current?.max || null
  );
  
  const updateOption = {
    animation: false,
    ...(!isAutoUpdate && { // ДОБАВИТЬ условие
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' }
    }
  }),
    yAxis: {
      min: yRange.min,
      max: yRange.max
    },
    series: formattedLines.map(line => ({
      animation: false,
      data: line.data
    }))
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
    
    // Собираем все временные точки из всех линий для определения диапазона X
    const allTimePoints = [];
    formattedLines.forEach(line => {
      line.data.forEach(point => {
        if (point && point[0] !== undefined) {
          allTimePoints.push(point[0]);
        }
      });
    });
    
    const newOption = {
      ...defaultOption,
      animation: false,
      tooltip: !isAutoUpdate ? {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        formatter: function(params) {
          if (!params || params.length === 0) return '';
          
          const timeValue = params[0].value[0];
          const formattedTime = formatTimeOnly(timeValue);
          
          let tooltipContent = `Время: ${formattedTime}<br/>`;
          
          // Добавляем все линии в tooltip
          params.forEach(param => {
            const value = param.value[1];
            const color = param.color;
            const seriesName = param.seriesName;
            tooltipContent += `<span style="display:inline-block;width:10px;height:10px;background-color:${color};border-radius:50%;margin-right:5px;"></span>`;
            tooltipContent += `${seriesName}: ${parseFloat(value.toFixed(6)).toString()}<br/>`;
          });
          
          return tooltipContent;
        }
      } : { show: false },
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
        ...defaultOption.xAxis,
        animation: false,
        data: allTimePoints,
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
            lines.length > 0 ? lines : null,
            currentXRangeRef.current?.min || null,
            currentXRangeRef.current?.max || null
          );
          return yRange.min;
        },
        max: function(value) {
          const yRange = calculateYRange(
            lines.length > 0 ? lines : null,
            currentXRangeRef.current?.min || null,
            currentXRangeRef.current?.max || null
          );
          return yRange.max;
        }
      },
      dataZoom: [
    {
      show: true,
      type: 'inside',
      filterMode: 'none',
      xAxisIndex: [0],
      zoomOnMouseWheel: true,
      moveOnMouseMove: true,
      moveOnMouseWheel: false,
      preventDefaultMouseMove: true
    }
  ],
  grid: {
    left: '3%',
    right: '4%',
    bottom: '5%',
    top: '10%',
    containLabel: true
  },
      // legend: {
      //   show: formattedLines.length > 1,  // Показываем легенду только если больше одной линии
      //   data: formattedLines.map(line => line.name),
      //   top: 10,
      //   left: 'center',
      //   textStyle: {
      //     color: '#fff',
      //     fontSize: 12
      //   },
      //   itemWidth: 25,
      //   itemHeight: 14
      // },
      series: formattedLines.map(line => ({
        name: line.name,
        type: 'line',
        showSymbol: false,
        clip: true,
        connectNulls: false,
        animation: false,
        itemStyle: {
          color: line.color
        },
        lineStyle: {
          color: line.color,
          width: 2.2
        },
        data: line.data
      }))
    };
    
    setOption(newOption);
    
    if (chartInstanceRef.current && !chartInstanceRef.current.isDisposed()) {
    try {
      chartInstanceRef.current.setOption(newOption, false, false); // ✅ Исправлено
    } catch (error) {
      console.error('Ошибка обновления графика:', error);
    }
  }
  }
  // console.log(lines)
  // console.log(chartData)
  // console.log(activeGraphUpdate)
  // console.log(chartInstance)

}, [chartData, lines, activeGraphUpdate, chartInstance]);

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
        notMerge={true}
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