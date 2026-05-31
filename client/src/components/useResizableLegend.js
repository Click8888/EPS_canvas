import { useState, useRef, useEffect, useCallback } from 'react';

// Управляемая ширина боковой колонки легенды с перетаскиванием разделителя.
//   containerRef — внешний flex-контейнер (область графика + легенда);
//   totalWidth   — логическая ширина этого контейнера (для клампа и учёта зума
//                  полотна React Flow);
//   defaultWidth — авто-ширина по умолчанию.
// Возвращает [legendWidth, startResize]: ширину (с клампом) и обработчик
// onMouseDown для разделителя.
export function useResizableLegend(containerRef, totalWidth, defaultWidth) {
  const [width, setWidth] = useState(defaultWidth);
  const userSetRef = useRef(false); // пользователь уже тянул разделитель?
  const totalRef = useRef(totalWidth);
  totalRef.current = totalWidth;

  // Пока пользователь не трогал разделитель — следуем за авто-дефолтом
  // (например, при ресайзе ноды). После ручной правки ширина фиксируется.
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
      // Учитываем зум полотна React Flow: rect масштабирован, а ширина легенды —
      // в логических px ноды.
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
