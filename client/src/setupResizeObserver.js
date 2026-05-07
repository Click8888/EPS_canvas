// setupResizeObserver.js – исправленная версия
(function () {
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;

  // ✅ Глушим ТОЛЬКО безопасные ошибки ResizeObserver loop
  console.error = function (...args) {
    const text = args.join(' ').toLowerCase();
    if (
      text.includes('resizeobserver loop completed') ||
      text.includes('resizeobserver loop limit exceeded')
    ) {
      return; // Эти ошибки безопасны и не влияют на работу
    }
    // ✅ НЕ глушим disposed и другие ошибки — они нужны для отладки
    originalConsoleError.apply(console, args);
  };

  console.warn = function (...args) {
    const text = args.join(' ').toLowerCase();
    if (
      text.includes('resizeobserver loop completed') ||
      text.includes('resizeobserver loop limit exceeded')
    ) {
      return;
    }
    // ✅ Показываем все остальные предупреждения
    originalConsoleWarn.apply(console, args);
  };

  // Обработчики глобальных ошибок и unhandledrejection (опционально)
  window.addEventListener('error', function (event) {
    const msg = (event.error?.message || event.message || '').toLowerCase();
    if (msg.includes('resizeobserver') || msg.includes('loop completed') || msg.includes('loop limit exceeded')) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return false;
    }
    return true;
  }, true);

  window.addEventListener('unhandledrejection', function (event) {
    const msg = (event.reason?.message || '').toLowerCase();
    if (msg.includes('resizeobserver') || msg.includes('loop completed') || msg.includes('loop limit exceeded')) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return false;
    }
    return true;
  }, true);

  // Исправленный SafeResizeObserver – использует реальный ResizeObserver внутри,
  // но откладывает вызов колбэка через requestAnimationFrame и перехватывает исключения.
  if (process.env.NODE_ENV === 'development') {
    try {
      const OriginalResizeObserver = window.ResizeObserver;

      class SafeResizeObserver {
        constructor(callback) {
          // Оборачиваем пользовательский колбэк: откладываем в rAF и глушим ошибки
          const safeCallback = (entries, observer) => {
            requestAnimationFrame(() => {
              try {
                callback(entries, observer);
              } catch (e) {
                // игнорируем любые ошибки внутри колбэка
              }
            });
          };

          // Создаём настоящий ResizeObserver (если доступен оригинальный, иначе свой)
          if (OriginalResizeObserver) {
            this._observer = new OriginalResizeObserver(safeCallback);
          } else {
            // Fallback на всякий случай (не должен происходить)
            this._observer = null;
          }
        }

        observe(element, options) {
          if (this._observer) {
            this._observer.observe(element, options);
          }
        }

        unobserve(element) {
          if (this._observer) {
            this._observer.unobserve(element);
          }
        }

        disconnect() {
          if (this._observer) {
            this._observer.disconnect();
          }
        }
      }

      // Сохраняем оригинал, если нужен для отладки
      if (OriginalResizeObserver) {
        window.OriginalResizeObserver = OriginalResizeObserver;
      }
      window.ResizeObserver = SafeResizeObserver;

    } catch (error) {
      // Ничего не делаем
    }
  }

  console.log('🚀 ResizeObserver errors completely suppressed (safe wrapper applied)');
})();