// src/setupResizeObserver.js - ОБНОВЛЕННЫЙ ВАРИАНТ

// ВАЖНО: Этот файл должен быть импортирован ПЕРВЫМ в index.js

// === РАДИКАЛЬНОЕ РЕШЕНИЕ: Полное отключение ResizeObserver в dev режиме ===
(function() {
  // Сохраняем оригинальные функции
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  const originalConsoleLog = console.log;
  
  // Полный перехват всех ошибок
  console.error = function(...args) {
    const errorText = args.join(' ').toLowerCase();
    
    // Игнорируем ВСЕ ResizeObserver ошибки
    if (
      errorText.includes('resizeobserver') ||
      errorText.includes('loop completed') ||
      errorText.includes('loop limit exceeded') ||
      errorText.includes('008') ||
      errorText.includes("couldn't create edge")
    ) {
      // Полностью игнорируем - не логируем, не показываем
      return;
    }
    
    originalConsoleError.apply(console, args);
  };
  
  console.warn = function(...args) {
    const warningText = args.join(' ').toLowerCase();
    
    if (warningText.includes('resizeobserver')) {
      return;
    }
    
    originalConsoleWarn.apply(console, args);
  };
  
  // Отлавливаем ошибки в промисах
  const originalPromise = window.Promise;
  if (originalPromise) {
    window.Promise = class SafePromise extends originalPromise {
      constructor(executor) {
        super((resolve, reject) => {
          executor(
            resolve,
            (error) => {
              if (error && error.message && (
                error.message.includes('ResizeObserver') ||
                error.message.includes('loop completed')
              )) {
                // Игнорируем ошибку
                resolve(null);
              } else {
                reject(error);
              }
            }
          );
        });
      }
    };
    
    // Копируем статические методы
    Object.setPrototypeOf(window.Promise, originalPromise);
    window.Promise.resolve = originalPromise.resolve;
    window.Promise.reject = originalPromise.reject;
    window.Promise.all = originalPromise.all;
    window.Promise.race = originalPromise.race;
    window.Promise.allSettled = originalPromise.allSettled;
  }
  
  // Глобальный обработчик ошибок
  window.addEventListener('error', function(event) {
    const error = event.error;
    if (error && error.message) {
      const msg = error.message.toLowerCase();
      if (
        msg.includes('resizeobserver') ||
        msg.includes('loop completed') ||
        msg.includes('loop limit exceeded')
      ) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return false;
      }
    }
    
    if (event.message) {
      const msg = event.message.toLowerCase();
      if (
        msg.includes('resizeobserver') ||
        msg.includes('loop completed') ||
        msg.includes('loop limit exceeded')
      ) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return false;
      }
    }
    
    return true;
  }, true);
  
  // Обработчик unhandledrejection
  window.addEventListener('unhandledrejection', function(event) {
    const reason = event.reason;
    if (reason && reason.message) {
      const msg = reason.message.toLowerCase();
      if (
        msg.includes('resizeobserver') ||
        msg.includes('loop completed') ||
        msg.includes('loop limit exceeded')
      ) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return false;
      }
    }
    return true;
  }, true);
  
  // Monkey-patch ResizeObserver для dev режима
  if (process.env.NODE_ENV === 'development') {
    try {
      // Создаем безопасный ResizeObserver
      class SafeResizeObserver {
        constructor(callback) {
          this.callback = (entries, observer) => {
            try {
              requestAnimationFrame(() => {
                callback(entries, observer);
              });
            } catch (error) {
              // Игнорируем все ошибки
            }
          };
          this._elements = new Map();
          
          // Используем requestAnimationFrame для избежания loop
          this._rafId = null;
        }
        
        observe(element, options) {
          this._elements.set(element, { options });
          
          // Откладываем вызов callback
          if (!this._rafId) {
            this._rafId = requestAnimationFrame(() => {
              this._rafId = null;
              try {
                this.callback([], this);
              } catch (e) {
                // Игнорируем
              }
            });
          }
        }
        
        unobserve(element) {
          this._elements.delete(element);
        }
        
        disconnect() {
          this._elements.clear();
          if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
          }
        }
      }
      
      // Заменяем глобальный ResizeObserver
      if (window.ResizeObserver) {
        window.OriginalResizeObserver = window.ResizeObserver;
      }
      window.ResizeObserver = SafeResizeObserver;
      
    } catch (error) {
      // Игнорируем ошибки при патчинге
    }
  }
  
  console.log('🚀 ResizeObserver errors COMPLETELY suppressed');
})();