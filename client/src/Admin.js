import React, { useState, useEffect, useCallback } from 'react';
import './Admin.css';

const API_BASE_URL = 'http://localhost:8080/api';

// Приведение значения ячейки к читаемому виду.
const formatCell = (v) => {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

// Перевод частых ответов сервера на русский (UI в остальном русскоязычный).
const localizeError = (msg) => {
  if (/only select/i.test(msg)) return 'Разрешены только запросы SELECT';
  if (/sql query is required/i.test(msg)) return 'Введите SQL-запрос';
  return msg;
};

const Admin = () => {
  const [tables, setTables] = useState([]);        // [{ table_name, columns: [{ column_name, data_type }] }]
  const [selectedTable, setSelectedTable] = useState('');
  const [rows, setRows] = useState([]);
  const [columns, setColumns] = useState([]);      // имена колонок из результата
  const [query, setQuery] = useState('');
  const [sourceLabel, setSourceLabel] = useState(''); // что сейчас показано (заголовок)
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Список таблиц из метаданных БД.
  const loadTables = useCallback(async () => {
    try {
      setError('');
      const res = await fetch(`${API_BASE_URL}/metadata`);
      if (!res.ok) throw new Error('не удалось загрузить список таблиц');
      const data = await res.json();
      setTables(data.metadata?.tables || data.tables || []);
    } catch (err) {
      setError(`Ошибка загрузки таблиц: ${err.message}`);
    }
  }, []);

  // Выполняет SELECT через /execute-query (сервер разрешает только SELECT) и показывает результат
  const runSelect = useCallback(async (sql, label) => {
    try {
      setIsLoading(true);
      setError('');
      const res = await fetch(`${API_BASE_URL}/execute-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Sql: sql })
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'ошибка выполнения запроса');
      const data = Array.isArray(result.data) ? result.data : [];
      setRows(data);
      setColumns(data.length > 0 ? Object.keys(data[0]) : []);
      setSourceLabel(label);
    } catch (err) {
      setRows([]);
      setColumns([]);
      setError(localizeError(err.message));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Выбор таблицы кликом.
  const viewTable = useCallback((name) => {
    setSelectedTable(name);
    runSelect(`SELECT * FROM ${name} LIMIT 1000`, `Таблица: ${name}`);
  }, [runSelect]);

  // Выбор через произвольный SQL-запрос.
  const runQuery = useCallback(() => {
    const sql = query.trim();
    if (!sql) return;
    setSelectedTable(''); // запрос — отдельный источник, снимаем подсветку таблицы
    runSelect(sql, 'Результат SQL-запроса');
  }, [query, runSelect]);

  useEffect(() => { loadTables(); }, [loadTables]);

  // Колонки для отображения: из результата, иначе (пустая таблица) — из метаданных.
  const displayColumns = columns.length > 0
    ? columns
    : (selectedTable
        ? (tables.find((t) => t.table_name === selectedTable)?.columns?.map((c) => c.column_name) || [])
        : []);

  return (
    <div className="admin-page">
      {/* ===== Левая панель: таблицы + SQL ===== */}
      <aside className="admin-sidebar">
        <section className="admin-panel">
          <div className="admin-panel-title">
            <i className="bi bi-table"></i>
            <span>Таблицы</span>
            <span className="admin-count">{tables.length}</span>
          </div>
          <div className="admin-table-list">
            {tables.length === 0 ? (
              <div className="admin-hint">Список пуст</div>
            ) : tables.map((t) => (
              <button
                key={t.table_name}
                className={`admin-table-item ${selectedTable === t.table_name ? 'active' : ''}`}
                onClick={() => viewTable(t.table_name)}
                title={`${t.table_name} · ${t.columns?.length || 0} столбцов`}
              >
                <i className="bi bi-grid-3x3"></i>
                <span className="admin-table-name">{t.table_name}</span>
                <span className="admin-table-cols">{t.columns?.length || 0}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-title">
            <i className="bi bi-code-slash"></i>
            <span>SQL-запрос</span>
          </div>
          <textarea
            className="admin-sql"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) runQuery(); }}
            placeholder="SELECT * FROM ..."
            spellCheck={false}
          />
          <button
            className="admin-run-btn"
            onClick={runQuery}
            disabled={isLoading || !query.trim()}
          >
            <i className="bi bi-play-fill"></i>
            Выполнить
          </button>
          <div className="admin-hint">Разрешены только запросы SELECT. Ctrl+Enter — выполнить.</div>
        </section>
      </aside>

      {/* ===== Основная область: таблица данных ===== */}
      <main className="admin-content">
        <div className="admin-content-header">
          <div className="admin-content-title">
            {sourceLabel || 'Просмотр данных'}
          </div>
          {sourceLabel && (
            <div className="admin-content-meta">
              <span className="admin-count">{rows.length} строк</span>
              {selectedTable && (
                <button
                  className="admin-icon-btn"
                  title="Обновить"
                  onClick={() => viewTable(selectedTable)}
                  disabled={isLoading}
                >
                  <i className="bi bi-arrow-clockwise"></i>
                </button>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="admin-error">
            <i className="bi bi-exclamation-triangle"></i>
            <span>{error}</span>
            <button className="admin-error-close" onClick={() => setError('')} title="Скрыть">
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
        )}

        <div className="admin-table-wrap">
          {isLoading ? (
            <div className="admin-state">
              <div className="admin-spinner" />
              <span>Загрузка…</span>
            </div>
          ) : !sourceLabel ? (
            <div className="admin-state">
              <i className="bi bi-database"></i>
              <span>Выберите таблицу слева или выполните SQL-запрос</span>
            </div>
          ) : displayColumns.length === 0 ? (
            <div className="admin-state">
              <i className="bi bi-inbox"></i>
              <span>Нет данных</span>
            </div>
          ) : (
            <table className="admin-data-table">
              <thead>
                <tr>
                  <th className="admin-row-num">#</th>
                  {displayColumns.map((c) => <th key={c}>{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td className="admin-no-rows" colSpan={displayColumns.length + 1}>Таблица пуста</td>
                  </tr>
                ) : rows.map((row, i) => (
                  <tr key={i}>
                    <td className="admin-row-num">{i + 1}</td>
                    {displayColumns.map((c) => (
                      <td key={c} title={formatCell(row[c])}>{formatCell(row[c])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
};

export default Admin;
