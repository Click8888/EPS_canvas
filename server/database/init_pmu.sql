-- Создание новой базы данных PMU
CREATE DATABASE pmu;

-- Подключаемся к новой БД
\c pmu

-- Включаем расширение TimescaleDB
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Создаём таблицу для измерений PMU
CREATE TABLE pmu_measurements (
    time TIMESTAMPTZ NOT NULL,
    current_value DOUBLE PRECISION,
    voltage_value DOUBLE PRECISION
);

-- Преобразуем таблицу в гипертаблицу TimescaleDB
SELECT create_hypertable('pmu_measurements', 'time');

-- Создаём индекс для оптимизации запросов по времени
CREATE INDEX idx_pmu_time ON pmu_measurements (time DESC);

-- ОПЦИОНАЛЬНО: Политика сжатия данных старше 7 дней
ALTER TABLE pmu_measurements SET (
    timescaledb.compress,
    timescaledb.compress_orderby = 'time DESC'
);

SELECT add_compression_policy('pmu_measurements', INTERVAL '7 days');

-- ОПЦИОНАЛЬНО: Политика удаления данных старше 30 дней
SELECT add_retention_policy('pmu_measurements', INTERVAL '30 days');

-- ОПЦИОНАЛЬНО: Создание непрерывного агрегата для почасовой статистики
CREATE MATERIALIZED VIEW pmu_measurements_hourly
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 hour', time) AS bucket,
    AVG(current_value) as avg_current,
    MAX(current_value) as max_current,
    MIN(current_value) as min_current,
    AVG(voltage_value) as avg_voltage,
    MAX(voltage_value) as max_voltage,
    MIN(voltage_value) as min_voltage,
    COUNT(*) as measurement_count
FROM pmu_measurements
GROUP BY bucket;

-- Политика обновления агрегата
SELECT add_continuous_aggregate_policy('pmu_measurements_hourly',
    start_offset => INTERVAL '3 hours',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour');