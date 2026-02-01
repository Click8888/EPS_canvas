import { AreaSeries, LineSeries, createChart, ColorType } from 'lightweight-charts';
import React, { useEffect, useRef, useState } from 'react';

export const Chart = props => {
    const {
        data,
        series = [],
        type,
        isUpdating,
        colors: {
            backgroundColor = '#2a2a2a',
            lineColor = '#133592',
            textColor = 'white',
            areaTopColor = '#2a4a9c', 
            areaBottomColor = '#1a2a5c', 
        } = {},
    } = props;

    const chartContainerRef = useRef();
    const chartRef = useRef(null);
    const seriesMapRef = useRef(new Map());
    const [resizeObserver, setResizeObserver] = useState(null);
    const lastDataRef = useRef([]);
    const previousSeriesRef = useRef([]);
    const isUpdatingRef = useRef(false);

    // Функция для преобразования 8-значного HEX в 6-значный
    const normalizeColor = (color) => {
        if (!color) return '#133592';
        
        if (color.length === 9 && color.startsWith('#')) {
            return color.substring(0, 7);
        }
        
        return color;
    };

    // Функция для преобразования времени HH:MM:SS.mmm в секунды
    const timeToSeconds = (timeString) => {
        if (!timeString) return 0;
        
        const [timePart, millisecondsPart] = timeString.split('.');
        const [hours, minutes, seconds] = timePart.split(':').map(Number);
        const milliseconds = millisecondsPart ? parseInt(millisecondsPart) : 0;
        
        return hours * 3600 + minutes * 60 + seconds + (milliseconds / 1000);
    };

    // Функция для форматирования секунд обратно в HH:MM:SS.mmm
    const secondsToTime = (totalSeconds) => {
        const hours = Math.floor(totalSeconds / 3600);
        const remainingAfterHours = totalSeconds % 3600;
        const minutes = Math.floor(remainingAfterHours / 60);
        const remainingAfterMinutes = remainingAfterHours % 60;
        const seconds = Math.floor(remainingAfterMinutes);
        const milliseconds = Math.round((remainingAfterMinutes - seconds) * 1000);
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
    };

    // Функция для обработки и валидации данных
const processChartData = (rawData) => {
    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) return [];

    // Используем массив для сохранения порядка
    const validData = [];
    
    rawData.forEach(item => {
        try {
            // Проверяем, что item не null/undefined и имеет необходимые поля
            if (item && item.time !== null && item.time !== undefined && 
                item.value !== null && item.value !== undefined) {
                
                const timeInSeconds = timeToSeconds(item.time);
                const numericValue = parseFloat(item.value);
                
                if (!isNaN(numericValue) && !isNaN(timeInSeconds)) {
                    validData.push({
                        time: timeInSeconds,
                        value: numericValue
                    });
                }
            }
        } catch (error) {
            console.warn('Ошибка при обработке элемента данных:', error, item);
        }
    });

    // Сортируем по времени
    validData.sort((a, b) => a.time - b.time);

    // Удаляем дубликаты по времени (сохраняем последнее значение)
    const uniqueData = [];
    const seenTimes = new Set();
    
    // Проходим с конца чтобы сохранять последние значения
    for (let i = validData.length - 1; i >= 0; i--) {
        const item = validData[i];
        if (!seenTimes.has(item.time)) {
            seenTimes.add(item.time);
            uniqueData.unshift(item); // Добавляем в начало чтобы сохранить порядок
        }
    }

    // Ограничиваем количество точек до 1500, сохраняя самые новые
    if (uniqueData.length > 1500) {
        return uniqueData.slice(-1500);
    }

    return uniqueData;
};

    // Эффект для создания графика
    useEffect(() => {
        if (!chartContainerRef.current) return;

        const handleResize = () => {
            if (chartRef.current && chartContainerRef.current) {
                chartRef.current.applyOptions({ 
                    width: chartContainerRef.current.clientWidth,
                    height: chartContainerRef.current.clientHeight
                });
            }
        };

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: backgroundColor },
                textColor,
            },
            width: chartContainerRef.current.clientWidth,
            height: 300,
            timeScale: {
                timeVisible: true,
                secondsVisible: true,
                tickMarkFormatter: (time) => {
                    return secondsToTime(time);
                }
            },
            grid: {
                vertLines: { color: '#444' },
                horzLines: { color: '#444' },
            },
            autoSize: true,
            handleScroll: {
                mouseWheel: true,
                pressedMouseMove: true,
            },
            handleScale: {
                axisPressedMouseMove: true,
                mouseWheel: true,
                pinch: true,
            },
            // Добавляем обработчик ошибок для перехвата null значений
            crosshair: {
                vertLine: {
                    labelVisible: false
                },
                horzLine: {
                    labelVisible: false
                }
            }
        });

        chartRef.current = chart;
        seriesMapRef.current = new Map();

        // СОЗДАЕМ ОСНОВНУЮ СЕРИЮ СРАЗУ ПРИ ИНИЦИАЛИЗАЦИИ ГРАФИКА
        const normalizedLineColor = normalizeColor(lineColor);
        const mainSeries = chart.addSeries(LineSeries, { 
            color: normalizedLineColor,
            lineWidth: 2,
            title: 'Основная серия',
            priceLineVisible: false,
            lastValueVisible: false
        });
        seriesMapRef.current.set('main', mainSeries);

        // ResizeObserver
        const observer = new ResizeObserver(entries => {
            for (let entry of entries) {
                if (entry.target === chartContainerRef.current) {
                    handleResize();
                }
            }
        });

        observer.observe(chartContainerRef.current);
        setResizeObserver(observer);

        return () => {
            observer.disconnect();
            if (chartRef.current) {
                chartRef.current.remove();
            }
        };
    }, [backgroundColor, textColor, lineColor]);

    // Эффект для управления всеми сериями
    useEffect(() => {
        if (!chartRef.current) return;

        const chart = chartRef.current;
        const seriesMap = seriesMapRef.current;
        const currentSeries = series || [];

        // ОБНОВЛЯЕМ НАСТРОЙКИ ОСНОВНОЙ СЕРИИ
        const mainSeries = seriesMap.get('main');
        if (mainSeries) {
            const normalizedLineColor = normalizeColor(lineColor);
            mainSeries.applyOptions({
                color: normalizedLineColor,
                lineWidth: 2,
                title: 'Основная серия'
            });
        }

        // Сравниваем с предыдущими сериями
        const prevSeries = previousSeriesRef.current;
        const seriesChanged = JSON.stringify(prevSeries.map(s => s.id)) !== 
                            JSON.stringify(currentSeries.map(s => s.id));

        if (seriesChanged) {
            // Удаляем только те серии, которых действительно нет
            Array.from(seriesMap.keys()).forEach(key => {
                if (key !== 'main' && !currentSeries.some(s => `series-${s.id}` === key)) {
                    const seriesToRemove = seriesMap.get(key);
                    if (seriesToRemove) {
                        try {
                            chart.removeSeries(seriesToRemove);
                        } catch (error) {
                            console.warn('Ошибка при удалении серии:', error);
                        }
                    }
                    seriesMap.delete(key);
                }
            });
        }

        // Создаем/обновляем дополнительные серии
        currentSeries.forEach(seriesItem => {
            if (seriesItem.enabled === false) return;

            const seriesKey = `series-${seriesItem.id}`;
            
            if (!seriesMap.has(seriesKey)) {
                try {
                    const newSeries = chart.addSeries(LineSeries, {
                        color: normalizeColor(seriesItem.color || '#ff0000'),
                        lineWidth: seriesItem.width || 2,
                        lineStyle: seriesItem.style === 'dashed' ? 1 : 0,
                        title: seriesItem.name || `Серия ${seriesItem.id}`,
                        priceLineVisible: false,
                        lastValueVisible: false
                    });
                    
                    seriesMap.set(seriesKey, newSeries);
                } catch (error) {
                    console.error('Ошибка при создании серии:', error);
                }
            }

            const existingSeries = seriesMap.get(seriesKey);
            if (existingSeries && seriesItem.data && seriesItem.data.length > 0) {
                try {
                    const processedData = processChartData(seriesItem.data);
                    if (processedData.length > 0) {
                        existingSeries.setData(processedData);
                    }
                } catch (error) {
                    console.error('Ошибка при обновлении данных серии:', error);
                }
            }
        });

        // Обновляем настройки существующих серий
        currentSeries.forEach(seriesItem => {
            const seriesKey = `series-${seriesItem.id}`;
            const existingSeries = seriesMap.get(seriesKey);
            
            if (existingSeries) {
                try {
                    existingSeries.applyOptions({
                        color: normalizeColor(seriesItem.color || '#ff0000'),
                        lineWidth: seriesItem.width || 2,
                        lineStyle: seriesItem.style === 'dashed' ? 1 : 0,
                        title: seriesItem.name || `Серия ${seriesItem.id}`
                    });
                } catch (error) {
                    console.error('Ошибка при обновлении настроек серии:', error);
                }
            }
        });

        previousSeriesRef.current = currentSeries;

    }, [series, lineColor]);

    // Эффект для обновления данных всех серий
useEffect(() => {
    const seriesMap = seriesMapRef.current;
    
    // Обновляем основную серию
    const mainSeries = seriesMap.get('main');
    if (mainSeries) {
        if (data && data.length > 0) {
            const processedData = processChartData(data);
            if (processedData && processedData.length > 0) {
                const finalData = processedData.length > 1500 
                    ? processedData.slice(-1500) 
                    : processedData;
                mainSeries.setData(finalData);
            } else {
                mainSeries.setData([]);
            }
        } else {
            mainSeries.setData([]);
        }
    }

    // Обновляем дополнительные серии
    series.forEach(seriesItem => {
        if (seriesItem.enabled !== false) {
            const seriesKey = `series-${seriesItem.id}`;
            const seriesInstance = seriesMap.get(seriesKey);
            
            if (seriesInstance && seriesItem.data && seriesItem.data.length > 0) {
                const processedSeriesData = processChartData(seriesItem.data);
                if (processedSeriesData && processedSeriesData.length > 0) {
                    const finalSeriesData = processedSeriesData.length > 1500 
                        ? processedSeriesData.slice(-1500) 
                        : processedSeriesData;
                    seriesInstance.setData(finalSeriesData);
                } else {
                    seriesInstance.setData([]);
                }
            } else if (seriesInstance) {
                seriesInstance.setData([]);
            }
        }
    });

}, [data, series, isUpdating]); // Добавляем series в зависимости

    // Эффект для обработки изменений размеров
    useEffect(() => {
        const handleResize = () => {
            if (chartRef.current && chartContainerRef.current) {
                try {
                    chartRef.current.applyOptions({ 
                        width: chartContainerRef.current.clientWidth,
                        height: chartContainerRef.current.clientHeight
                    });
                } catch (error) {
                    console.error('Ошибка при изменении размера:', error);
                }
            }
        };

        if (resizeObserver && chartContainerRef.current) {
            handleResize();
        }
    }, [resizeObserver]);

    return (
        <div
            ref={chartContainerRef}
            style={{ 
                width: '100%', 
                height: '100%', 
                minHeight: '300px',
                position: 'relative'
            }}
        >
            {(!data || data.length === 0) && series.every(s => !s.data || s.data.length === 0) && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: '#888',
                    textAlign: 'center',
                    zIndex: 10
                }}>
                    <i className="bi bi-bar-chart" style={{ fontSize: '2rem', display: 'block', marginBottom: '10px' }}></i>
                    <span>Нет данных для отображения</span>
                </div>
            )}
        </div>
    );
};

export default Chart;