import React, { useState, useEffect, useRef } from 'react';

const EditableTitle = ({ value, onSave, isSelected }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    if (editValue.trim() && editValue !== value) {
      onSave(editValue.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditValue(value);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        className="chart-title-input"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleSave}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#2d2d2d',
          border: '1px solid #6c757d',
          borderRadius: '4px',
          color: '#fff',
          fontSize: '14px',
          fontWeight: '500',
          padding: '2px 8px',
          outline: 'none',
          width: 'auto',
          minWidth: '100px'
        }}
      />
    );
  }

  return (
    <div 
      className="chart-title-display"
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (isSelected) setIsEditing(true);
      }}
      style={{ cursor: isSelected ? 'pointer' : 'default', display: 'inline-flex', alignItems: 'center' }}
      title={isSelected ? "Двойной клик для переименования" : ""}
    >
      <span>{value}</span>
      {isSelected && (
        <i 
          className="bi bi-pencil-square ms-2" 
          style={{ fontSize: '12px', opacity: 0.6, cursor: 'pointer' }}
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(true);
          }}
        />
      )}
    </div>
  );
};

export default EditableTitle;