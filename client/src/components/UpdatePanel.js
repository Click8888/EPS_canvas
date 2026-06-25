import { useState, useEffect } from 'react';
import { useTheme } from './ThemeContext';
import '../App.css';

const API = 'http://localhost:8080/api';

export default function UpdatePanel() {
  const { isDark } = useTheme();

  const [installed, setInstalled] = useState(null);  // установленная версия
  const [known, setKnown]         = useState(false); // известна ли установленная версия
  const [check, setCheck]         = useState(null);  // результат /check-update
  const [loading, setLoading]     = useState(true);
  const [checking, setChecking]   = useState(false);
  const [updating, setUpdating]   = useState(false);
  const [phase, setPhase]         = useState('');
  const [error, setError]         = useState('');

  const cardClass  = isDark ? 'card bg-dark text-light border-secondary' : 'card';
  const codeBg     = isDark ? '#1a1a2e' : '#f8f9fa';
  const mutedClass = isDark ? 'text-secondary' : 'text-muted';

  useEffect(() => {
    loadVersion();
  }, []);

  const loadVersion = async () => {
    setLoading(true);
    setError('');
    try {
      const res  = await fetch(`${API}/version`, { cache: 'no-store' });
      const data = await res.json();
      setInstalled(data.installed);
      setKnown(!!data.installedKnown);
    } catch {
      setError('Не удалось получить версию — бэкенд не отвечает.');
    } finally {
      setLoading(false);
    }
  };

  const checkForUpdate = async () => {
    setChecking(true);
    setError('');
    setCheck(null);
    try {
      const res  = await fetch(`${API}/check-update`, { cache: 'no-store' });
      const data = await res.json();
      setCheck(data);
      setInstalled(data.installed);
      setKnown(!!data.installedKnown);
      if (data.error) setError(data.error);
    } catch {
      setError('Не удалось проверить обновления — бэкенд не отвечает.');
    } finally {
      setChecking(false);
    }
  };

  // Ждём, пока бэкенд снова поднимется после перезапуска.
  const waitForBackend = async () => {
    for (let i = 0; i < 60; i++) {
      try {
        const r = await fetch(`${API}/version`, { cache: 'no-store' });
        if (r.ok) return true;
      } catch { /* сервер ещё перезапускается */ }
      await new Promise(res => setTimeout(res, 2000));
    }
    return false;
  };

  const doUpdate = async () => {
    if (!window.confirm('Скачать последнюю версию с GitHub и установить? Бэкенд будет перезапущен.')) return;
    setUpdating(true);
    setError('');
    setPhase('Скачиваю обновление с GitHub…');
    try {
      const res  = await fetch(`${API}/update`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'Не удалось обновить.');
        setUpdating(false);
        return;
      }
      setPhase('Обновление установлено. Бэкенд перезапускается, подождите…');
      const ok = await waitForBackend();
      if (ok) {
        setPhase('Готово! Перезагружаю страницу…');
        setTimeout(() => window.location.reload(), 1200);
      } else {
        setError('Бэкенд не поднялся за отведённое время. Проверьте консоль run.bat.');
        setUpdating(false);
      }
    } catch {
      setError('Ошибка связи с сервером во время обновления.');
      setUpdating(false);
    }
  };

  const Commit = ({ c }) => (
    <div className="p-2 rounded" style={{ background: codeBg }}>
      <div>
        <code className="text-info">{c?.short || '—'}</code>
        <span className={`ms-2 ${mutedClass}`} style={{ fontSize: '0.85rem' }}>{c?.date}</span>
      </div>
      {c?.subject && <div className="mt-1" style={{ fontSize: '0.9rem' }}>{c.subject}</div>}
    </div>
  );

  return (
    <div className="container py-4" style={{ maxWidth: 720 }}>
      <h4 className="mb-4">
        <i className="bi bi-cloud-arrow-down-fill me-2 text-info" />
        Версия и обновление
      </h4>

      {error && (
        <div className="alert alert-danger py-2">
          <i className="bi bi-exclamation-triangle-fill me-2" />
          {error}
        </div>
      )}

      {/* Установленная версия */}
      <div className={`${cardClass} mb-3`}>
        <div className="card-body">
          <h6 className="card-title">
            <i className="bi bi-box-seam me-2" />
            Установленная версия
          </h6>

          {loading ? (
            <div className={mutedClass}><span className="spinner-border spinner-border-sm me-2" />Загрузка…</div>
          ) : known ? (
            <Commit c={installed} />
          ) : (
            <div className="alert alert-warning py-2 mb-0">
              <i className="bi bi-question-circle-fill me-2" />
              Версия ещё не зафиксирована. Нажмите «Проверить обновления», затем «Обновить».
            </div>
          )}
        </div>
      </div>

      {/* Обновление с GitHub */}
      <div className={cardClass}>
        <div className="card-body">
          <h6 className="card-title">
            <i className="bi bi-github me-2" />
            Обновление с GitHub
          </h6>

          <div className="d-flex gap-2 mb-3">
            <button
              className="btn btn-outline-info btn-sm"
              onClick={checkForUpdate}
              disabled={checking || updating}
            >
              {checking
                ? <><span className="spinner-border spinner-border-sm me-1" />Проверяю…</>
                : <><i className="bi bi-arrow-repeat me-1" />Проверить обновления</>}
            </button>

            <button
              className="btn btn-success btn-sm"
              onClick={doUpdate}
              disabled={updating || !check?.updateAvailable}
            >
              {updating
                ? <><span className="spinner-border spinner-border-sm me-1" />Обновляю…</>
                : <><i className="bi bi-download me-1" />Обновить до последней версии</>}
            </button>
          </div>

          {updating && phase && (
            <div className="alert alert-info py-2">
              <i className="bi bi-hourglass-split me-2" />
              {phase}
            </div>
          )}

          {check && !check.error && !updating && (
            check.updateAvailable ? (
              <div>
                <div className="alert alert-success py-2">
                  <i className="bi bi-stars me-2" />
                  Доступна новая версия!
                </div>
                <div className={`${mutedClass} mb-1`} style={{ fontSize: '0.85rem' }}>Последняя версия на GitHub:</div>
                <Commit c={check.latest} />
              </div>
            ) : (
              <div className="alert alert-secondary py-2 mb-0">
                <i className="bi bi-check-circle-fill me-2 text-success" />
                У вас установлена последняя версия.
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
