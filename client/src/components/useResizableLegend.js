import { useState, useRef, useEffect, useCallback } from 'react';

// ширина боковой колонки легенды, тянется за разделитель
// возвращает [ширина, обработчик onMouseDown]
export function useResizableLegend(containerRef, totalWidth, defaultWidth) {
  const [width, setWidth] = useState(defaultWidth);
  const userSetRef = useRef(false); // пользователь уже тянул разделитель?
  const totalRef = useRef(totalWidth);
  totalRef.current = totalWidth;

  // пока разделитель не трогали, следуем за дефолтной шириной
  useEffect(() => {
    if (!userSetRef.current) setWidth(defaultWidth);
  }, [defaultWidth]);

  const clampWidth = useCallback((w) => {
    const total = totalRef.current;
    const maxW = total ? Math.max(160, total - 200) : 600;
    return Math.round(Math.min(maxW, Math.max(160, w)));
  }, []);

  const startResize = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    userSetRef.current = true;

    const onMove = (ev) => {
      const el = containerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const total = totalRef.current;
      // поправка на зум полотна
      const zoom = total && r.width ? r.width / total : 1;
      setWidth(clampWidth((r.right - ev.clientX) / zoom));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.classList.remove('resizing-legend');
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.classList.add('resizing-legend');
  }, [containerRef, clampWidth]);

  return [clampWidth(width), startResize];
}
