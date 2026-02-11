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

const defaultOption = {
  animation: true,
  title: {
    text: 'График данных'
  },
  xAxis: {
    type: 'category',
    data: [],
    minorTick: {
      show: true
    },
    minorSplitLine: {
      show: true
    }
  },
  yAxis: {
    type: 'value',
    minorTick: {
      show: true
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
    bottom: '3%',
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
        // Извлекаем время
        if (item.time !== undefined) {
          time.push(item.time);
        }
        
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
        data: formattedData.time
      },
      series: [
        {
          ...defaultOption.series[0],
          data: formattedData.values,
          name: 'Данные'
        }
      ]
    };
    //console.log("123123132", formattedData)
    setOption(newOption);
    
    // Обновляем график с анимацией
    chartInstance.setOption(newOption, true);

    // console.log('График обновлен:', {
    //   timePoints: formattedData.time,
    //   dataPoints: formattedData.values
    // });

  }, [chartData, activeGraphUpdate, chartInstance]);

  return (
    <div
      id="graph"
      style={{ 
        width: width, 
        height: height,
        minHeight: '300px'
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