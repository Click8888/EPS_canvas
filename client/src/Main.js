import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Main.css';

function Main() {
  
  const navigate = useNavigate();

  const handleGoToGraph = () => {
    navigate('/graph');
  };

  return(
    <div className="main-container vh-100 overflow-hidden" style={{  
      backgroundColor: '#474747ff',
    }}>
      {/* Header Section */}
      <div className="text-center py-5 overflow-hidden">
        <h1 className="main-title text-white mb-3">
          <i className="bi bi-graph-up me-3"></i>
          Visual Graph (Alpha Version)
        </h1>
        <p className="main-subtitle text-light opacity-75">
          Мощная платформа для анализа и визуализации данных в реальном времени
        </p>
      </div>

      {/* Features Grid */}
      <div className="container-fluid flex-grow-1 overflow-hidden">
        <div className="row justify-content-center">
          <div className="col-xl-8 col-lg-10">
            <div className="row g-4">
              {/* Feature 1 */}
              <div className="col-md-4">
                <div className="feature-card card h-100 border-0 shadow-sm">
                  <div className="card-body text-center p-4">
                    <div className="feature-icon mb-3">
                      <i className="bi bi-graph-up-arrow fs-1 text-primary"></i>
                    </div>
                    <h5 className="card-title text-white">Интерактивные графики</h5>
                    <p className="card-text text-light opacity-75">
                      Линейные и векторные типы графиков с настройкой в реальном времени
                    </p>
                  </div>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="col-md-4">
                <div className="feature-card card h-100 border-0 shadow-sm">
                  <div className="card-body text-center p-4">
                    <div className="feature-icon mb-3">
                      <i className="bi bi-database fs-1 text-primary"></i>
                    </div>
                    <h5 className="card-title text-white">SQL интеграция</h5>
                    <p className="card-text text-light opacity-75">
                      Прямое выполнение запросов к базам данных и мгновенная визуализация результатов
                    </p>
                  </div>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="col-md-4">
                <div className="feature-card card h-100 border-0 shadow-sm">
                  <div className="card-body text-center p-4">
                    <div className="feature-icon mb-3">
                      <i className="bi bi-arrow-repeat fs-1 text-primary"></i>
                    </div>
                    <h5 className="card-title text-white">Real-time данные</h5>
                    <p className="card-text text-light opacity-75">
                      Автоматическое обновление графиков с настраиваемыми интервалами
                    </p>
                  </div>
                </div>
              </div>

              {/* Feature 4 */}
              <div className="col-md-4">
                <div className="feature-card card h-100 border-0 shadow-sm">
                  <div className="card-body text-center p-4">
                    <div className="feature-icon mb-3">
                      <i className="bi bi-grid-3x3-gap fs-1 text-primary"></i>
                    </div>
                    <h5 className="card-title text-white">Множественные графики</h5>
                    <p className="card-text text-light opacity-75">
                      До 6 одновременных графиков с Drag&Drop перестановкой
                    </p>
                  </div>
                </div>
              </div>

              {/* Feature 5 */}
              <div className="col-md-4">
                <div className="feature-card card h-100 border-0 shadow-sm">
                  <div className="card-body text-center p-4">
                    <div className="feature-icon mb-3">
                      <i className="bi bi-sliders fs-1 text-primary"></i>
                    </div>
                    <h5 className="card-title text-white">Гибкая настройка</h5>
                    <p className="card-text text-light opacity-75">
                      Настройка цветов, осей, сетки и других параметров отображения
                    </p>
                  </div>
                </div>
              </div>

              {/* Feature 6 */}
              <div className="col-md-4">
                <div className="feature-card card h-100 border-0 shadow-sm">
                  <div className="card-body text-center p-4">
                    <div className="feature-icon mb-3">
                      <i className="bi bi-lightning-charge fs-1 text-primary"></i>
                    </div>
                    <h5 className="card-title text-white">Высокая производительность</h5>
                    <p className="card-text text-light opacity-75">
                      Оптимизированная работа с большими объемами данных до 1500 точек
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Button */}
      <div className="text-center py-5">
        <button 
          className="btn btn-primary btn-lg px-5 py-3"
          onClick={handleGoToGraph}
          style={{
            backgroundColor: '#133592',
            borderColor: '#133592',
            borderRadius: '25px',
            fontSize: '1.2rem',
            fontWeight: '600'
          }}
        >
          <i className="bi bi-play-fill me-2"></i>
          Начать работу с графиками
        </button>
      </div>
    </div>
  )
}

export default Main;