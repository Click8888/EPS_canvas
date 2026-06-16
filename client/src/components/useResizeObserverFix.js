import { useEffect } from 'react';

export const useResizeObserverFix = () => {
  useEffect(() => {
    // сохраняем оригинал ResizeObserver
    const OriginalResizeObserver = window.ResizeObserver;
    
    // обёртка, чтобы гасить ошибки resize
    window.ResizeObserver = class SafeResizeObserver extends OriginalResizeObserver {
      constructor(callback) {
        const safeCallback = (entries, observer) => {
          try {
            callback(entries, observer);
          } catch (error) {
            // ошибки resize не логируем
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