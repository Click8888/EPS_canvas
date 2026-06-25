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
  const [status, setStatus]                 = useState(null);
  const [form, setForm]                     = useState(DEFAULT_FORM);
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState('');
  const [successMsg, setSuccessMsg]         = useState('');
  const { isDark, toggleTheme } = useTheme();

  // классы инпутов под тёмную/светлую тему
  const inputClass = `form-control form-control-sm ${isDark ? 'bg-dark text-light border-secondary' : 'bg-white text-dark border-secondary'}`;
  const codeBgClass = isDark ? '#1a1a2e' : '#f8f9fa';
  const modalContentClass = isDark ? 'modal-content bg-dark text-light' : 'modal-content';
  const modalHeaderClass = isDark ? 'modal-header border-secondary' : 'modal-header';
  const modalFooterClass = isDark ? 'modal-footer border-secondary' : 'modal-footer';
  const labelClass = isDark ? 'form-label text-secondary small mb-1' : 'form-label text-muted small mb-1';
  const closeBtnClass = isDark ? 'btn-close btn-close-white' : 'btn-close';

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

  const isConnected = status?.connected;
  const badgeLabel  = isConnected
    ? `${status.config?.dbname}@${status.config?.host}:${status.config?.port}`
    : 'Нет подключения';

  return (
    <>
      <nav className={`navbar ${isDark ? 'navbar-dark bg-dark' : 'navbar-light bg-light'}`}>
        <div className="container-fluid">
          <a className="navbar-brand fw-bold" href="/">EPS</a>
          <div className="d-flex align-items-center gap-2">
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
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={() => setShowModal(true)}
            >
              <i className="bi bi-plug-fill me-1" />
              Подключиться к БД
            </button>
            <a className="btn btn-outline-secondary btn-sm" href="/admin">
              <i className="bi bi-gear-fill me-1" />
              Админ-панель
            </a>
            <a className="btn btn-outline-secondary btn-sm" href="/update" title="Версия и обновление">
              <i className="bi bi-cloud-arrow-down-fill me-1" />
              Обновление
            </a>
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

      {showModal && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1050 }}
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className={modalContentClass}>
              <div className={modalHeaderClass}>
                <h5 className="modal-title">
                  <i className="bi bi-database-fill me-2 text-info" />
                  Подключение к БД
                </h5>
                <button
                  type="button"
                  className={closeBtnClass}
                  onClick={closeModal}
                />
              </div>

              <form onSubmit={handleConnect}>
                <div className="modal-body">
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
                    <div className="col-8">
                      <label className={labelClass}>
                        <i className="bi bi-hdd-network me-1" />Хост
                      </label>
                      <input
                        type="text"
                        className={inputClass}
                        value={form.host}
                        onChange={e => field('host', e.target.value)}
                        placeholder="localhost"
                        required
                      />
                    </div>
                    <div className="col-4">
                      <label className={labelClass}>
                        <i className="bi bi-ethernet me-1" />Порт
                      </label>
                      <input
                        type="number"
                        className={inputClass}
                        value={form.port}
                        onChange={e => field('port', e.target.value)}
                        placeholder="5432"
                        min={1} max={65535}
                        required
                      />
                    </div>
                    <div className="col-6">
                      <label className={labelClass}>
                        <i className="bi bi-person-fill me-1" />Пользователь
                      </label>
                      <input
                        type="text"
                        className={inputClass}
                        value={form.user}
                        onChange={e => field('user', e.target.value)}
                        placeholder="postgres"
                        required
                      />
                    </div>
                    <div className="col-6">
                      <label className={labelClass}>
                        <i className="bi bi-key-fill me-1" />Пароль
                      </label>
                      <input
                        type="password"
                        className={inputClass}
                        value={form.password}
                        onChange={e => field('password', e.target.value)}
                        placeholder="••••••••"
                        autoComplete="current-password"
                      />
                    </div>
                    <div className="col-12">
                      <label className={labelClass}>
                        <i className="bi bi-database me-1" />База данных
                      </label>
                      <input
                        type="text"
                        className={inputClass}
                        value={form.dbname}
                        onChange={e => field('dbname', e.target.value)}
                        placeholder="mydb"
                        required
                      />
                    </div>
                  </div>

                  <div className="mt-3 p-2 rounded" style={{ background: codeBgClass }}>
                    <small className="text-secondary">
                      <i className="bi bi-link-45deg me-1" />
                      <code className="text-info" style={{ fontSize: '0.7rem' }}>
                        jdbc:postgresql://{form.user || '…'}@{form.host || '…'}:{form.port}/{form.dbname || '…'}
                      </code>
                    </small>
                  </div>
                </div>

                <div className={modalFooterClass}>
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