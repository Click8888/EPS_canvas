import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import { ColorType } from 'lightweight-charts';

const API_BASE_URL = 'http://localhost:8080/api';

const Admin = () => {
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [tableData, setTableData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [editingRow, setEditingRow] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [newRowData, setNewRowData] = useState({});
  const [query, setQuery] = useState('');


  // Загрузка списка таблиц
  const loadTables = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/metadata`);
      if (!response.ok) throw new Error('Ошибка загрузки метаданных');
      
      const data = await response.json();
      const metadata = data.metadata || data;
      
      if (metadata.tables) {
        setTables(metadata.tables.map(table => table.table_name));
      }
    } catch (err) {
      setError(`Ошибка загрузки таблиц: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Загрузка данных таблицы
  const loadTableData = useCallback(async (tableName) => {
    if (!tableName) return;
    
    try {

      setIsLoading(true);
      setError('');
      setSuccessMessage('');
      
      const Sql= `SELECT * FROM ${tableName} LIMIT 1000`;

      const response = await fetch(`${API_BASE_URL}/execute-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Sql })

      });
      if (!response.ok) throw new Error('Ошибка загрузки данных');
      
      const result = await response.json();
      const data = result.data || result;
      console.log(data)


        // Получаем названия колонок из первого элемента
        if (data.length > 0) {
          setTableData(data);
          setColumns(Object.keys(data[0]));
          console.log(data)
        } else {
          // Если данных нет, получаем колонки из метаданных
          const metaResponse = await fetch(`${API_BASE_URL}/metadata`);
          const metadata = await metaResponse.json();
          console.log(tableData)
          metadata.metadata.tables.forEach(table => {
            setColumns(table.columns.map(col => col.column_name));
          })
          console.log(columns)
        }

      
      
    } catch (err) {
      setError(`Ошибка загрузки данных: ${err.message}`);
    } finally {
      setIsLoading(false);
      
    }
  }, []);

  // Выполнение произвольного SQL запроса
  const SqlQuery = useCallback(async () => {
    if (!query.trim()) return;
    
    try {
      setIsLoading(true);
      setError('');
      setSuccessMessage('');
      
      const Sql = query

      const response = await fetch(`${API_BASE_URL}/sqlquery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Sql })
      });

      if (!response.ok) throw new Error('Ошибка выполнения запроса');
      const result = await response.json();
      setTableData(result.data);
      setColumns(Object.keys(result.data[0]));

    } catch (err) {
      setError(`Ошибка выполнения запроса: ${err.message}`);
    } finally {
      
      setIsLoading(false);
    }
    

  }, [query]);

  // Обновление строки
  const updateRow = useCallback(async (tableName, rowData, originalData) => {
    try {
      setIsLoading(true);
      
      // Формируем SET часть запроса
      const setClause = Object.entries(rowData)
        .filter(([key]) => key in originalData)
        .map(([key, value]) => `${key} = '${value}'`)
        .join(', ');
      
      // Формируем WHERE часть запроса (используем оригинальные значения для идентификации строки)
      const whereClause = Object.entries(originalData)
        .map(([key, value]) => `${key} = '${value}'`)
        .join(' AND ');
      
      const Sql = `UPDATE ${tableName} SET ${setClause} WHERE ${whereClause}`;
      
      const response = await fetch(`${API_BASE_URL}/updaterow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Sql })
      });

      if (!response.ok) throw new Error('Ошибка обновления данных');
      
      setSuccessMessage('Данные успешно обновлены');
      setEditingRow(null);
      loadTableData(tableName);
      
    } catch (err) {
      setError(`Ошибка обновления: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [loadTableData]);

  // -----Удаление строки
  const deleteRow = useCallback(async (tableName, rowData) => {
  if (!window.confirm('Вы уверены, что хотите удалить эту запись?')) return;
  
  try {
    setIsLoading(true);
    
    const whereClause = Object.entries(rowData)
      .map(([key, value]) => `${key} = '${value}'`)
      .join(' AND ');
    
    const Sql = `DELETE FROM ${tableName} WHERE ${whereClause}`;
    
    const response = await fetch(`${API_BASE_URL}/delrow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Sql })
    });
    
    if (!response.ok) throw new Error('Ошибка удаления данных');
    
    const result = await response.json();
    setSuccessMessage(`Запись успешно удалена (затронуто строк: ${result.rows_affected})`);
    
    // Автоматически обновляем данные таблицы
    loadTableData(tableName);
    
  } catch (err) {
    setError(`Ошибка удаления: ${err.message}`);
  } finally {
    setIsLoading(false);
  }
}, [loadTableData]);

  // Добавление новой строки
  const addRow = useCallback(async (tableName, rowData) => {
    try {
      setIsLoading(true);
      
      const columns = Object.keys(rowData).join(', ');
      const values = Object.values(rowData).map(value => `'${value}'`).join(', ');
      
      const Sql = `INSERT INTO ${tableName} (${columns}) VALUES (${values})`;
      
      const response = await fetch(`${API_BASE_URL}/addrow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Sql })
      });

      if (!response.ok) throw new Error('Ошибка добавления данных');
      
      setSuccessMessage('Запись успешно добавлена');
      setNewRowData({});
      loadTableData(tableName);
      
    } catch (err) {
      setError(`Ошибка добавления: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [loadTableData]);

  // Очистка таблицы
  const clearTable = useCallback(async (tableName) => {
    if (!window.confirm('Вы уверены, что хотите очистить всю таблицу? Это действие нельзя отменить.')) return;
    
    try {
      setIsLoading(true);
      
      const Sql = `DELETE FROM ${tableName}`;

      const response = await fetch(`${API_BASE_URL}/deltable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Sql })
      });

      if (!response.ok) throw new Error('Ошибка очистки таблицы');
      
      setSuccessMessage('Таблица успешно очищена');
      loadTableData(tableName);
      
    } catch (err) {
      setError(`Ошибка очистки: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [loadTableData]);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  useEffect(() => {
    if (selectedTable) {
      loadTableData(selectedTable);
    }
  }, [selectedTable, loadTableData]);

  const handleEditClick = (row, index) => {
    setEditingRow(index);
    setEditFormData({ ...row });
  };

  const handleEditFormChange = (field, value) => {
    setEditFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveClick = () => {
    updateRow(selectedTable, editFormData, tableData[editingRow]);
  };

  const handleCancelEdit = () => {
    setEditingRow(null);
  };

  const handleNewRowChange = (field, value) => {
    setNewRowData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddNewRow = () => {
    addRow(selectedTable, newRowData);
  };

  return (
    <div className="admin-container">
      <div className="admin-header text-center mt-4 mb-4" style={{color: "rgba(137, 137, 234, 1)"}}>
        <h2><i className="bi bi-database-gear me-2" ></i>Админ-панель базы данных</h2>
        <p>Управление таблицами и данными</p>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show">
          <i className="bi bi-exclamation-triangle me-2"></i>
          {error}
          <button type="button" className="btn-close" onClick={() => setError('')}></button>
        </div>
      )}

      {successMessage && (
        <div className="alert alert-success alert-dismissible fade show">
          <i className="bi bi-check-circle me-2"></i>
          {successMessage}
          <button type="button" className="btn-close" onClick={() => setSuccessMessage('')}></button>
        </div>
      )}

      <div className="row">
        {/* Панель управления таблицами */}
        <div className="col-md-3">
          <div className="card admin-card">
            <div className="card-header">
              <h5><i className="bi bi-table me-2"></i>Таблицы</h5>
            </div>
            <div className="card-body">
              <div className="list-group">
                {tables.map(table => (
                  <button
                    key={table}
                    className={`list-group-item list-group-item-action ${selectedTable === table ? 'active' : ''}`}
                    onClick={() => setSelectedTable(table)}
                  >
                    <i className="bi bi-table me-2"></i>
                    {table}
                  </button>
                ))}
              </div>
              
              {selectedTable && (
                <div className="mt-3">
                  <button
                    className="btn btn-danger btn-sm w-100"
                    onClick={() => clearTable(selectedTable)}
                    disabled={isLoading}
                  >
                    <i className="bi bi-trash me-1"></i>
                    Очистить таблицу
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* SQL редактор */}
          <div className="card admin-card mt-3">
            <div className="card-header">
              <h5><i className="bi bi-code-slash me-2"></i>SQL Запрос</h5>
            </div>
            <div className="card-body">
              <textarea
                className="form-control mb-2"
                rows="4"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Введите SQL запрос..."
                style={{ fontFamily: 'monospace', fontSize: '14px' }}
              />
              <button
                className="btn btn-primary w-100"
                onClick={SqlQuery}
                disabled={isLoading || !query.trim()}
              >
                <i className="bi bi-play-fill me-1"></i>
                Выполнить
              </button>
            </div>
          </div>
        </div>

        {/* Содержимое таблицы */}
        <div className="col-md-9">
          {selectedTable ? (
            <div className="card admin-card">
              <div className="card-header d-flex justify-content-between align-items-center">
                <h5>
                  <i className="bi bi-table me-2"></i>
                  Таблица: {selectedTable}
                  <span className="badge bg-secondary ms-2">{tableData.length} записей</span>
                </h5>
                <button
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => loadTableData(selectedTable)}
                  disabled={isLoading}
                >
                  <i className="bi bi-arrow-clockwise"></i>
                </button>
              </div>
              
              <div className="card-body">
                {/* Форма добавления новой записи */}
                <div className="mb-4 p-3 bg-light rounded">
                  <h6><i className="bi bi-plus-circle me-2"></i>Добавить новую запись</h6>
                  <div className="row g-2">
                    {columns.map(column => (
                      <div key={column} className="col-md-3">
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder={column}
                          value={newRowData[column] || ''}
                          onChange={(e) => handleNewRowChange(column, e.target.value)}
                        />
                      </div>
                      
                    ))}
                    {/* {console.log(columns)} */}
                  </div>
                  <button
                    className="btn btn-success btn-sm mt-2"
                    onClick={handleAddNewRow}
                    disabled={isLoading || Object.keys(newRowData).length === 0}
                  >
                    <i className="bi bi-plus me-1"></i>
                    Добавить
                  </button>
                </div>

                {/* Таблица данных */}
                {isLoading ? (
                  <div className="text-center py-4">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Загрузка...</span>
                    </div>
                    <p className="mt-2">Загрузка данных...</p>
                  </div>
                ) : tableData.length > 0 ? (
                  <div className="table-responsive">
                    <table className="table table-striped table-hover">
                      <thead>
                        <tr>
                          <th>Действия</th>
                          {columns.map(column => (
                            <th key={column}>{column}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tableData.map((row, index) => (
                          
                          <tr key={index}>
                            <td>
                              {editingRow === index ? (
                                <>
                                  <button
                                    className="btn btn-success btn-sm me-1"
                                    onClick={handleSaveClick}
                                    title="Сохранить"
                                  >
                                    <i className="bi bi-check"></i>
                                  </button>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={handleCancelEdit}
                                    title="Отменить"
                                  >
                                    <i className="bi bi-x"></i>
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    className="btn btn-warning btn-sm me-1"
                                    onClick={() => handleEditClick(row, index)}
                                    title="Редактировать"
                                  >
                                    <i className="bi bi-pencil"></i>
                                  </button>
                                  <button
                                    className="btn btn-danger btn-sm"
                                    onClick={() => deleteRow(selectedTable, row)}
                                    title="Удалить"
                                  >
                                    <i className="bi bi-trash"></i>
                                  </button>
                                </>
                              )}
                            </td>
                            {Object.keys(row).map((column) => (
                              <td key={column}>
                                {editingRow === index ? (
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    value={editFormData[column] || ''}
                                    onChange={(e) => handleEditFormChange(column, e.target.value)}
                                  />
                                ) : (
                                  row[column]?.toString() || '-'
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted">
                    <i className="bi bi-inbox display-4"></i>
                    <p>Таблица пуста</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-5 text-muted">
              <i className="bi bi-database display-4"></i>
              <p>Выберите таблицу для просмотра данных</p>
            </div>
          )}

      
        </div>
      </div>
    </div>
  );
};

export default Admin;