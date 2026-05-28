import React from 'react';

const getCursor = (direction) => {
  switch (direction) {
    case 'top-left':
    case 'bottom-right': return 'nwse-resize';
    case 'top-right':
    case 'bottom-left': return 'nesw-resize';
    case 'top':
    case 'bottom':      return 'ns-resize';
    case 'left':
    case 'right':       return 'ew-resize';
    default:            return 'default';
  }
};

const CustomResizer = ({ 
  selected, id, nodeSize, setNodeSize, setIsResizing, 
  minWidth, minHeight, maxWidth = Infinity, maxHeight = Infinity,
  getNode, setNodes 
}) => {
  if (!selected) return null;

  const startResize = (e, direction) => {
    e.preventDefault();
    e.stopPropagation();

    const currentNode = getNode(id);
    const startPosX = currentNode.position.x;
    const startPosY = currentNode.position.y;
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = nodeSize.width;
    const startHeight = nodeSize.height;
    
    setIsResizing(true);
    document.body.style.cursor = getCursor(direction);

    let animationFrameId = null;
    
    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      
      let newWidth = startWidth;
      let newHeight = startHeight;
      let newPosX = startPosX;
      let newPosY = startPosY;
      
      switch (direction) {
        case 'right':
          newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + deltaX));
          break;
        case 'left':
          newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth - deltaX));
          if (newWidth !== startWidth) newPosX = startPosX + (startWidth - newWidth);
          break;
        case 'bottom':
          newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight + deltaY));
          break;
        case 'top':
          newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight - deltaY));
          if (newHeight !== startHeight) newPosY = startPosY + (startHeight - newHeight);
          break;
        case 'top-left':
          newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth - deltaX));
          newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight - deltaY));
          if (newWidth !== startWidth) newPosX = startPosX + (startWidth - newWidth);
          if (newHeight !== startHeight) newPosY = startPosY + (startHeight - newHeight);
          break;
        case 'top-right':
          newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + deltaX));
          newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight - deltaY));
          if (newHeight !== startHeight) newPosY = startPosY + (startHeight - newHeight);
          break;
        case 'bottom-left':
          newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth - deltaX));
          newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight + deltaY));
          if (newWidth !== startWidth) newPosX = startPosX + (startWidth - newWidth);
          break;
        case 'bottom-right':
          newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + deltaX));
          newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight + deltaY));
          break;
      }
      
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      
      animationFrameId = requestAnimationFrame(() => {
        setNodeSize({ width: newWidth, height: newHeight });
        setNodes((nds) =>
          nds.map((node) => {
            if (node.id === id) {
              return {
                ...node,
                position: { x: newPosX, y: newPosY },
                data: { ...node.data, width: newWidth, height: newHeight }
              };
            }
            return node;
          })
        );
      });
    };

    const handleMouseUp = () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      setIsResizing(false);
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <>
      <div className="resize-handle-square top-left" onMouseDown={(e) => startResize(e, 'top-left')} />
      <div className="resize-handle-square top-right" onMouseDown={(e) => startResize(e, 'top-right')} />
      <div className="resize-handle-square bottom-left" onMouseDown={(e) => startResize(e, 'bottom-left')} />
      <div className="resize-handle-square bottom-right" onMouseDown={(e) => startResize(e, 'bottom-right')} />
      <div className="resize-handle-square top" onMouseDown={(e) => startResize(e, 'top')} />
      <div className="resize-handle-square right" onMouseDown={(e) => startResize(e, 'right')} />
      <div className="resize-handle-square bottom" onMouseDown={(e) => startResize(e, 'bottom')} />
      <div className="resize-handle-square left" onMouseDown={(e) => startResize(e, 'left')} />
    </>
  );
};

export default CustomResizer;