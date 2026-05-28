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
import globalDataStream from './GlobalDataStream';

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
    const date = new Date(timeValue * 1000);
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
  
  if (typeof timeValue === 'number' && timeValue < 1000000000) {
    const hours = Math.floor(timeValue / 3600);
    const minutes = Math.floor((timeValue % 3600) / 60);
    const seconds = Math.floor(timeValue % 60);
    const milliseconds = Math.floor((timeValue % 1) * 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  }
  
  if (typeof timeValue === 'number' && timeValue > 1000000000) {
    const date = new Date(timeValue * 1000);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const milliseconds = date.getMilliseconds().toString().padStart(3, '0');
    
    return `${hours}:${minutes}:${seconds}.${milliseconds}`;
  }
  
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
  if (typeof timeValue === 'number' && timeValue < 1000000000) {
    return timeValue;
  }
  
  if (typeof timeValue === 'number' && timeValue > 1000000000) {
    return timeValue;
  }
  
  if (typeof timeValue === 'string') {
    const fullDateMatch = timeValue.match(/\d{4}-\d{2}-\d{2}/);
    if (fullDateMatch) {
      const date = new Date(timeValue);
      if (!isNaN(date.getTime())) {
        return date.getTime() / 1000;
      }
    }
    
    const timeMatch = timeValue.match(/^(\d{1,2}):(\d{1,2}):(\d{1,2})(?:\.(\d+))?$/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1], 10) || 0;
      const minutes = parseInt(timeMatch[2], 10) || 0;
      const seconds = parseInt(timeMatch[3], 10) || 0;
      
      let milliseconds = 0;
      if (timeMatch[4]) {
        const msString = timeMatch[4].padEnd(3, '0').substring(0, 3);
        milliseconds = parseInt(msString, 10) / 1000;
      }
      
      return hours * 3600 + minutes * 60 + seconds + milliseconds;
    }
    
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
      return `Время: ${formattedTime}<br/>Значение: ${parseFloat(value.toFixed(6)).toString()}`;
    }
  },
  axisPointer: {
    link: { xAxisIndex: 'all' },
    label: {
      formatter: function(params) {
        if (params.axisDimension === 'x') {
          return formatTimeOnly(params.value);
        }
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
      hideOverlap: true,
      showMinLabel: true,
      showMaxLabel: true
    },
    minInterval: 0.001,
    splitLine: {
      show: false
    },
    axisTick: {
      show: true
    },
    axisLine: {
      show: true,
      onZero: true,
      lineStyle: {
        color: '#888',
        width: 2
      }
    }
  },
  yAxis: {
    type: 'value',
    scale: false,
    animation: false,
    axisLabel: {
      formatter: function(value) {
        return value.toFixed(1);
      }
    },
    minorTick: {
      show: true
    },
    splitLine: {
      show: true,
      lineStyle: {
        color: '#444'
      }
    },
    axisLine: {
      show: true,
      onZero: true,
      lineStyle: {
        color: '#888',
        width: 2
      }
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
  const [userInteracting, setUserInteracting] = useState(false);
  const userInteractingRef = useRef(false);
  const [currentXRange, setCurrentXRange] = useState(null);
  const prevLinesDataRef = useRef(null);
  const subscriptionIdRef = useRef(null); // ID подписки в глобальном стриме
  const [localLines, setLocalLines] = useState(lines); // Локальное состояние для линий

  const dpr = window.devicePixelRatio || 1;

  // Преобразуем данные одной линии в формат ECharts
  const formatLineDataForECharts = (data) => {
    if (!data || !Array.isArray(data)) return [];

    const limitedData = data.length > 200 ? data.slice(-200) : data;
    const formattedData = [];

    limitedData.forEach(item => {
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
        
        if (item.value !== undefined) {
          formattedData.push([timeInSeconds, item.value]);
        }
      }
    });

    return formattedData;
  };

  // Преобразуем все линии в формат ECharts
  const formatAllLinesForECharts = (linesData) => {
    if (!linesData || !Array.isArray(linesData) || linesData.length === 0) {
      if (chartData && Array.isArray(chartData)) {
        return [{
          name: 'Данные',
          color: '#1f02c3',
          data: formatLineDataForECharts(chartData)
        }];
      }
      return [];
    }

    return linesData.map(line => ({
      name: line.name || 'Без названия',
      color: line.color || '#1f02c3',
      data: formatLineDataForECharts(line.data || [])
    }));
  };

  // Функция для расчета диапазона Y на основе видимых данных X для всех линий
  const calculateYRange = (linesData, xMin, xMax) => {
    if (!linesData || !Array.isArray(linesData) || linesData.length === 0) {
      if (chartData && Array.isArray(chartData)) {
        return calculateYRangeForSingleLine(chartData, xMin, xMax);
      }
      return { min: 0, max: 100 };
    }

    let minY = Infinity;
    let maxY = -Infinity;

    linesData.forEach(line => {
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
          chartInstanceRef.current = instance;
          setChartInstance(instance);
        }
      } catch (error) {
        console.error('Ошибка инициализации графика:', error);
      }
    }

    return () => {
      if (chartInstanceRef.current && !chartInstanceRef.current.isDisposed()) {
        chartInstanceRef.current.dispose();
      }
      chartInstanceRef.current = null;
      setChartInstance(null);
    };
  }, []);

  // Начальная настройка графика
  useEffect(() => {
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
          const option = chartInstance.getOption();
          if (option && option.xAxis && option.xAxis[0]) {
            let newXRange = null;
            
            if (xAxisZoom.startValue !== undefined && xAxisZoom.endValue !== undefined) {
              newXRange = {
                min: xAxisZoom.startValue,
                max: xAxisZoom.endValue
              };
            } else if (xAxisZoom.start !== undefined && xAxisZoom.end !== undefined) {
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
            
            if (newXRange) {
              currentXRangeRef.current = newXRange;
              setCurrentXRange(newXRange);
              const yRange = calculateYRange(
                localLines.length > 0 ? localLines : null,
                newXRange.min,
                newXRange.max
              );
              
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
      if (chartInstanceRef.current && !chartInstanceRef.current.isDisposed()) {
        chartInstanceRef.current.off('dataZoom', handleDataZoomEvent);
      }
    };
  }, [chartInstance, localLines]);

  // Отслеживание взаимодействия пользователя с графиком
  useEffect(() => {
    if (!chartInstanceRef.current || chartInstanceRef.current.isDisposed()) return;

    const handleDataZoom = (params) => {
      if (params.batch && params.batch.length > 0) {
        const isUserAction = params.batch[0].start !== undefined || params.batch[0].end !== undefined;
        if (isUserAction) {
          userInteractingRef.current = true;
          setUserInteracting(true);
        }
      }
    };

    const handleRestore = () => {
      userInteractingRef.current = false;
      setUserInteracting(false);
    };

    chartInstanceRef.current.on('dataZoom', handleDataZoom);
    chartInstanceRef.current.on('restore', handleRestore);

    return () => {
      if (chartInstanceRef.current && !chartInstanceRef.current.isDisposed()) {
        chartInstanceRef.current.off('dataZoom', handleDataZoom);
        chartInstanceRef.current.off('restore', handleRestore);
      }
    };
  }, [chartInstance]);

  // ПОДПИСКА НА ГЛОБАЛЬНЫЙ СТРИМ ДАННЫХ
  useEffect(() => {
    // Если нет линий или автообновление выключено - отписываемся
    if (!localLines || localLines.length === 0 || !isAutoUpdate) {
      if (subscriptionIdRef.current) {
        globalDataStream.unsubscribe(subscriptionIdRef.current);
        subscriptionIdRef.current = null;
      }
      return;
    }

    // Проверяем, что у линий есть необходимые параметры
    const validLines = localLines.filter(line => line.table && line.xAxis && line.yAxis);
    if (validLines.length === 0) return;

    console.log(`[Chart] Подписка на глобальный стрим для ${validLines.length} линий`);

    // Подписываемся на глобальный стрим
    const subId = globalDataStream.subscribe(
      `chart_${Date.now()}_${Math.random()}`, // уникальный ID для этой подписки
      validLines,
      500, // Интервал обновления (позже будет настраиваемым)
      (updatedLines, timestamp) => {
        console.log(`[Chart] Получены обновленные данные от глобального стрима, ${updatedLines.length} линий`);
        
        // Обновляем локальное состояние линий
        setLocalLines(prevLines => {
          // Мержим обновленные линии с существующими (сохраняем цвета и имена)
          const updatedLinesMap = new Map(updatedLines.map(l => [l.id, l]));
          const mergedLines = prevLines.map(line => {
            if (updatedLinesMap.has(line.id)) {
              return { ...line, data: updatedLinesMap.get(line.id).data };
            }
            return line;
          });
          return mergedLines;
        });
      }
    );
    
    subscriptionIdRef.current = subId;
    
    // Отписка при размонтировании или изменении зависимостей
    return () => {
      if (subscriptionIdRef.current) {
        console.log(`[Chart] Отписка от глобального стрима`);
        globalDataStream.unsubscribe(subscriptionIdRef.current);
        subscriptionIdRef.current = null;
      }
    };
  }, [localLines, isAutoUpdate]); // Зависимости: линии и флаг автообновления

  // Синхронизация внешних lines с локальным состоянием
  useEffect(() => {
    if (lines && Array.isArray(lines) && lines.length > 0) {
      setLocalLines(prevLines => {
        // Сохраняем существующие данные при обновлении метаданных
        const existingDataMap = new Map(prevLines.map(l => [l.id, l.data]));
        const newLines = lines.map(line => ({
          ...line,
          data: existingDataMap.get(line.id) || line.data || []
        }));
        return newLines;
      });
    }
  }, [lines]);

  // Обновление данных графика
  useEffect(() => {
    if (!chartInstanceRef.current) return;

    // Проверяем, действительно ли изменились данные в линиях
    const currentLinesData = JSON.stringify(localLines.map(l => ({
      id: l.id,
      dataLength: l.data?.length,
      lastPoint: l.data?.length > 0 ? l.data[l.data.length - 1] : null
    })));
    
    if (prevLinesDataRef.current === currentLinesData) {
      return;
    }
    prevLinesDataRef.current = currentLinesData;

    // Форматируем данные всех линий
    const formattedLines = formatAllLinesForECharts(localLines);
    
    // Если нет линий, пробуем использовать старый формат chartData
    if (formattedLines.length === 0 && chartData) {
      const fallbackLine = {
        name: 'Данные',
        color: '#1f02c3',
        data: formatLineDataForECharts(chartData)
      };
      formattedLines.push(fallbackLine);
    }
    
    if (formattedLines.length === 0) return;
    
    // Проверяем, взаимодействует ли пользователь с графиком
    if (userInteractingRef.current) {
      // РЕЖИМ 1: Пользователь взаимодействует - обновляем данные И ось Y
      const yRange = calculateYRange(
        localLines.length > 0 ? localLines : null,
        currentXRangeRef.current?.min || null,
        currentXRangeRef.current?.max || null
      );
      
      const updateOption = {
        animation: false,
        ...(!isAutoUpdate && {
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
        axisPointer: {
          link: { xAxisIndex: 'all' },
          label: {
            formatter: function(params) {
              if (params.axisDimension === 'x') {
                return formatTimeOnly(params.value);
              }
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
          min: function() {
            const yRange = calculateYRange(
              localLines.length > 0 ? localLines : null,
              currentXRangeRef.current?.min || null,
              currentXRangeRef.current?.max || null
            );
            return yRange.min;
          },
          max: function() {
            const yRange = calculateYRange(
              localLines.length > 0 ? localLines : null,
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
          chartInstanceRef.current.setOption(newOption, false, false);
        } catch (error) {
          console.error('Ошибка обновления графика:', error);
        }
      }
    }
  }, [chartData, localLines, activeGraphUpdate, chartInstance, isAutoUpdate]);

  return (
    <div
      id="graph"
      style={{ 
        width: width, 
        height: height,
        position: 'relative',
        cursor: 'grab'
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
          devicePixelRatio: dpr * 2
        }}
      />
      
      {userInteracting && (
        <button
          onClick={() => {
            if (chartInstance && typeof chartInstance.dispatchAction === 'function') {
              try {
                chartInstance.dispatchAction({ type: 'restore' });
                userInteractingRef.current = false;
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