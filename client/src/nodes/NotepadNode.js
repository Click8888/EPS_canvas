import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import EditableTitle from './EditableTitle';
import CustomResizer from './CustomResizer';

// Узел-заметка на холсте: заголовок (ручка перетаскивания) + текстовое поле.
// Перетаскивается за заголовок, ресайзится как графики, текст хранится в node.data.text
// и попадает в сохранение полотна (serializeNode сохраняет произвольные поля data).
const NotepadNode = ({ data, selected, id }) => {
  const { getNode, setNodes } = useReactFlow();
  const [nodeSize, setNodeSize] = useState({ width: data.width || 360, height: data.height || 280 });
  const [isResizing, setIsResizing] = useState(false);
  const [text, setText] = useState(data.text || '');
  const isFocusedRef = useRef(false);
  const nodeRef = useRef(null);

  // Размер восстанавливается из data (импорт/загрузка полотна).
  useEffect(() => {
    if (data.width && data.height) {
      setNodeSize({ width: data.width, height: data.height });
    }
  }, [data.width, data.height]);

  // Подхватываем текст из data (импорт/восстановление), но только когда поле не в фокусе —
  // чтобы не затирать то, что пользователь печатает прямо сейчас.
  useEffect(() => {
    if (!isFocusedRef.current && data.text !== undefined && data.text !== text) {
      setText(data.text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.text]);

  // Запись текста в node.data (нужно для сохранения полотна).
  const persistText = useCallback((value) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, text: value } } : node
      )
    );
  }, [id, setNodes]);

  // Печать держим в локальном состоянии (мгновенный отклик), а в общий стейт графа
  // пишем с задержкой — иначе каждое нажатие клавиши перерисовывало бы все узлы.
  useEffect(() => {
    if (!isFocusedRef.current) return; // персистим только пользовательский ввод
    const t = setTimeout(() => persistText(text), 400);
    return () => clearTimeout(t);
  }, [text, persistText]);

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div
      ref={nodeRef}
      className={`notepad-node ${isResizing ? 'resizing' : ''}`}
      style={{
        width: nodeSize.width,
        height: nodeSize.height,
        minWidth: 220,
        minHeight: 140,
        position: 'relative'
      }}
      onContextMenu={handleContextMenu}
    >
      <CustomResizer
        selected={selected}
        id={id}
        nodeSize={nodeSize}
        setNodeSize={setNodeSize}
        setIsResizing={setIsResizing}
        minWidth={220}
        minHeight={140}
        getNode={getNode}
        setNodes={setNodes}
      />

      <div className="notepad-node-header">
        <div className="notepad-node-title">
          <i className="bi bi-journal-text"></i>
          <EditableTitle
            value={data.label || 'Блокнот'}
            onSave={(newTitle) =>
              setNodes((nds) =>
                nds.map((node) =>
                  node.id === id ? { ...node, data: { ...node.data, label: newTitle } } : node
                )
              )
            }
            isSelected={selected}
          />
        </div>
      </div>

      {/* nodrag — клик/выделение текста не двигает узел; nowheel — прокрутка заметки не зумит холст */}
      <div className="notepad-node-body nodrag nowheel">
        <textarea
          className="notepad-textarea"
          value={text}
          placeholder="Введите заметки…"
          onChange={(e) => setText(e.target.value)}
          onFocus={() => { isFocusedRef.current = true; }}
          onBlur={() => { isFocusedRef.current = false; persistText(text); }}
          style={{
            fontFamily: data.fontFamily || 'sans-serif',
            fontSize: `${data.fontSize || 14}px`,
            fontWeight: data.bold ? 'bold' : 'normal',
            fontStyle: data.italic ? 'italic' : 'normal',
            textDecoration: data.underline ? 'underline' : 'none'
          }}
        />
      </div>
    </div>
  );
};

export default NotepadNode;
