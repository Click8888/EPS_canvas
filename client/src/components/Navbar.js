import { useState, useEffect } from 'react';
import { useTheme } from './ThemeContext';
import './navbar.css';
import '../App.css';

const API = 'http://localhost:8080/api';

const DEFAULT_FORM = {
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: '',
  dbname: '',
};

export default function Navbar() {
  const [showModal, setShowModal]           = useState(false);
  const [status, setStatus]                 = useState(null);   // { connected, config }
  const [form, setForm]                     = useState(DEFAULT_FORM);
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState('');
  const [successMsg, setSuccessMsg]         = useState('');
  const { isDark, toggleTheme } = useTheme();

  /* ───── загружаем статус при старте ───── */
  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const res  = await fetch(`http://localhost:8080/api/connection-status`);
      const data = await res.json();
      setStatus(data);
      if (data.config) {
        setForm(prev => ({
          ...prev,
          host:   data.config.host   || 'localhost',
          port:   data.config.port   || 5432,
          user:   data.config.user   || 'postgres',
          dbname: data.config.dbname || '',
        }));
      }
    } catch {
      setStatus({ connected: false, config: {} });
    }
  };

  /* ───── отправка формы ───── */
  const handleConnect = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await fetch(`http://localhost:8080/api/connect`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, port: Number(form.port) }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Неизвестная ошибка');
      } else {
        setSuccessMsg('Подключение установлено!');
        setStatus({ connected: true, config: data.config });
        // Генерируем событие для обновления таблиц в Sidebar
        window.dispatchEvent(new CustomEvent('db-connection-changed', {
          detail: { config: data.config }
        }));

        setTimeout(() => closeModal(), 1500);
      }
    } catch {
      setError('Не удалось связаться с сервером');
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setError('');
    setSuccessMsg('');
  };

  const field = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  /* ───── индикатор в Navbar ───── */
  const isConnected = status?.connected;
  const badgeLabel  = isConnected
    ? `${status.config?.dbname}@${status.config?.host}:${status.config?.port}`
    : 'Нет подключения';

return (
    <>
      {/* ════════════════ NAVBAR ════════════════ */}
      <nav className={`navbar ${isDark ? 'navbar-dark bg-dark' : 'navbar-light bg-light'}`}>
        <div className="container-fluid">
          <a className="navbar-brand fw-bold" href="/">EPS</a>

          <div className="d-flex align-items-center gap-2">

            {/* Индикатор статуса */}
            <span
              className={`badge d-flex align-items-center gap-1 px-2 py-1 ${
                isConnected ? 'bg-success' : 'bg-danger'
              }`}
              title={isConnected ? 'Подключено' : 'Нет соединения'}
            >
              <i className={`bi ${isConnected ? 'bi-database-fill-check' : 'bi-database-fill-x'}`} />
              <span className="d-none d-md-inline" style={{ fontSize: '0.75rem' }}>
                {badgeLabel}
              </span>
            </span>

            {/* Кнопка подключения */}
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={() => setShowModal(true)}
            >
              <i className="bi bi-plug-fill me-1" />
              Подключиться к БД
            </button>

            {/* Кнопка админки */}
            <a className="btn btn-outline-secondary btn-sm" href="/admin">
              <i className="bi bi-gear-fill me-1" />
              Админ-панель
            </a>

              {/* Кнопка переключения темы */}
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={toggleTheme}
              title={isDark ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'}
            >
              <i className={`bi ${isDark ? 'bi-sun-fill' : 'bi-moon-fill'}`} />
            </button>
          </div>
        </div>
      </nav>

      {/* ══════════════════ МОДАЛЬНОЕ ОКНО ══════════════════ */}
      {showModal && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1050 }}
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">

              {/* Заголовок */}
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-database-fill me-2 text-info" />
                  Подключение к PostgreSQL
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={closeModal}
                />
              </div>

              {/* Форма */}
              <form onSubmit={handleConnect}>
                <div className="modal-body">

                  {/* Алерты */}
                  {error && (
                    <div className="alert alert-danger py-2 mb-3">
                      <i className="bi bi-exclamation-triangle-fill me-2" />
                      {error}
                    </div>
                  )}
                  {successMsg && (
                    <div className="alert alert-success py-2 mb-3">
                      <i className="bi bi-check-circle-fill me-2" />
                      {successMsg}
                    </div>
                  )}

                  <div className="row g-3">
                    {/* Хост */}
                    <div className="col-8">
                      <label className="form-label text-secondary small mb-1">
                        <i className="bi bi-hdd-network me-1" />Хост
                      </label>
                      <input
                        type="text"
                        className="form-control form-control-sm bg-dark text-light border-secondary"
                        value={form.host}
                        onChange={e => field('host', e.target.value)}
                        placeholder="localhost"
                        required
                      />
                    </div>

                    {/* Порт */}
                    <div className="col-4">
                      <label className="form-label text-secondary small mb-1">
                        <i className="bi bi-ethernet me-1" />Порт
                      </label>
                      <input
                        type="number"
                        className="form-control form-control-sm bg-dark text-light border-secondary"
                        value={form.port}
                        onChange={e => field('port', e.target.value)}
                        placeholder="5432"
                        min={1} max={65535}
                        required
                      />
                    </div>

                    {/* Пользователь */}
                    <div className="col-6">
                      <label className="form-label text-secondary small mb-1">
                        <i className="bi bi-person-fill me-1" />Пользователь
                      </label>
                      <input
                        type="text"
                        className="form-control form-control-sm bg-dark text-light border-secondary"
                        value={form.user}
                        onChange={e => field('user', e.target.value)}
                        placeholder="postgres"
                        required
                      />
                    </div>

                    {/* Пароль */}
                    <div className="col-6">
                      <label className="form-label text-secondary small mb-1">
                        <i className="bi bi-key-fill me-1" />Пароль
                      </label>
                      <input
                        type="password"
                        className="form-control form-control-sm bg-dark text-light border-secondary"
                        value={form.password}
                        onChange={e => field('password', e.target.value)}
                        placeholder="••••••••"
                        autoComplete="current-password"
                      />
                    </div>

                    {/* База данных */}
                    <div className="col-12">
                      <label className="form-label text-secondary small mb-1">
                        <i className="bi bi-database me-1" />База данных
                      </label>
                      <input
                        type="text"
                        className="form-control form-control-sm bg-dark text-light border-secondary"
                        value={form.dbname}
                        onChange={e => field('dbname', e.target.value)}
                        placeholder="mydb"
                        required
                      />
                    </div>
                  </div>

                  {/* Строка подключения (для справки) */}
                  <div className="mt-3 p-2 rounded" style={{ background: '#1a1a2e' }}>
                    <small className="text-secondary">
                      <i className="bi bi-link-45deg me-1" />
                      <code className="text-info" style={{ fontSize: '0.7rem' }}>
                        jdbc:postgresql://{form.user || '…'}@{form.host || '…'}:{form.port}/{form.dbname || '…'}
                        {/*jdbc:postgresql://host:port/database*/}
                      </code>
                    </small>
                  </div>
                </div>

                {/* Кнопки */}
                <div className="modal-footer border-secondary">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={closeModal}
                    disabled={loading}
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="btn btn-info btn-sm"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1" />
                        Подключение…
                      </>
                    ) : (
                      <>
                        <i className="bi bi-plug-fill me-1" />
                        Подключиться
                      </>
                    )}
                  </button>
                </div>
              </form>

            </div>
          </div>
        </div>
      )}
    </>
  );
}
