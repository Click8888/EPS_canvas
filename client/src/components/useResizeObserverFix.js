import { useEffect } from 'react';

export const useResizeObserverFix = () => {
  useEffect(() => {
    // Сохраняем оригинальный ResizeObserver
    const OriginalResizeObserver = window.ResizeObserver;
    
    // Создаем обертку для подавления ошибок
    window.ResizeObserver = class SafeResizeObserver extends OriginalResizeObserver {
      constructor(callback) {
        const safeCallback = (entries, observer) => {
          try {
            callback(entries, observer);
          } catch (error) {
            // Игнорируем ResizeObserver ошибки
            if (!error.message?.includes('ResizeObserver')) {
              console.error(error);
            }
          }
        };
        
        super(safeCallback);
      }
    };
    
    return () => {
      window.ResizeObserver = OriginalResizeObserver;
    };
  }, []);
};