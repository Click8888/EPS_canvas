import { useRef, useCallback, useEffect } from 'react';

export const useHighPerformanceChart = (initialData = [], updateInterval = 20) => {
  const dataRef = useRef(initialData);
  const animationFrameRef = useRef(null);
  const lastUpdateRef = useRef(Date.now());
  const updateCallbacksRef = useRef([]);

  // Добавление данных с высокой частотой
  const appendData = useCallback((newData) => {
    if (!Array.isArray(newData)) newData = [newData];
    
    dataRef.current = [...dataRef.current, ...newData];
    
    // Ограничиваем количество точек для производительности
    if (dataRef.current.length > 5000) {
      dataRef.current = dataRef.current.slice(-4000);
    }
    
    // Вызываем колбэки обновления
    updateCallbacksRef.current.forEach(callback => {
      callback(dataRef.current);
    });
  }, []);

  // Подписка на обновления данных
  const subscribeToUpdates = useCallback((callback) => {
    updateCallbacksRef.current.push(callback);
    
    return () => {
      updateCallbacksRef.current = updateCallbacksRef.current.filter(cb => cb !== callback);
    };
  }, []);

  // Сброс данных
  const resetData = useCallback(() => {
    dataRef.current = [];
    updateCallbacksRef.current.forEach(callback => {
      callback([]);
    });
  }, []);

  // Настройка автоматического обновления
  const startAutoUpdate = useCallback((dataGenerator) => {
    const update = () => {
      const now = Date.now();
      if (now - lastUpdateRef.current >= updateInterval) {
        const newData = dataGenerator ? dataGenerator() : [];
        if (newData.length > 0) {
          appendData(newData);
        }
        lastUpdateRef.current = now;
      }
      animationFrameRef.current = requestAnimationFrame(update);
    };
    
    animationFrameRef.current = requestAnimationFrame(update);
  }, [appendData, updateInterval]);

  // Остановка обновления
  const stopAutoUpdate = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      stopAutoUpdate();
    };
  }, [stopAutoUpdate]);

  return {
    data: dataRef.current,
    appendData,
    resetData,
    subscribeToUpdates,
    startAutoUpdate,
    stopAutoUpdate
  };
};