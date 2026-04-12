# Миграция на TimescaleDB - Инструкция по запуску

## Выполненные изменения

✅ Создан SQL скрипт инициализации БД PMU: `server/database/init_pmu.sql`
✅ Создана модель PMUMeasurement: `server/models/pmu.go`
✅ Обновлен `server/main.go` - изменен DBName на "pmu"
✅ Обновлен `server/routes/database.go` - работа с PMUMeasurement
✅ Переписан `server/routes/generation.go` - удалена генерация, добавлены функции чтения
✅ Создан скрипт генерации тестовых данных: `server/scripts/generate_test_data.go`
✅ Удалена старая модель `server/models/user.go`

## Следующие шаги

### 1. Создать базу данных PMU в PostgreSQL

Откройте PgAdmin или psql и выполните SQL скрипт:

```bash
psql -U postgres -f server/database/init_pmu.sql
```

Или в PgAdmin:
1. Откройте Query Tool
2. Откройте файл `server/database/init_pmu.sql`
3. Выполните скрипт (F5)

**Важно:** Убедитесь, что TimescaleDB установлен в вашем PostgreSQL!

### 2. Проверить подключение

Запустите сервер:

```bash
cd server
go run main.go
```

В логах должно быть:
- ✅ Нет ошибок подключения к БД
- ✅ Список зарегистрированных routes
- ✅ Сервер запущен на :8080

### 3. Запустить генератор тестовых данных

В новом терминале:

```bash
cd server
go run scripts/generate_test_data.go
```

Генератор будет создавать записи каждые 20мс. Подождите 10-20 секунд, затем остановите (Ctrl+C).

### 4. Проверить данные в БД

В PgAdmin или psql:

```sql
-- Подключиться к БД PMU
\c pmu

-- Проверить количество записей
SELECT COUNT(*) FROM pmu_measurements;

-- Посмотреть последние 10 записей
SELECT * FROM pmu_measurements ORDER BY time DESC LIMIT 10;

-- Проверить информацию о гипертаблице
SELECT * FROM timescaledb_information.hypertables WHERE hypertable_name = 'pmu_measurements';

-- Проверить chunks (партиции)
SELECT * FROM timescaledb_information.chunks WHERE hypertable_name = 'pmu_measurements';
```

### 5. Протестировать API endpoints

**Получить все данные:**
```
GET http://localhost:8080/api/getparams
```

**Выполнить SQL запрос:**
```
POST http://localhost:8080/api/execute-query
Content-Type: application/json

{
  "Sql": "SELECT * FROM pmu_measurements LIMIT 10"
}
```

**Получить метаданные БД:**
```
GET http://localhost:8080/api/metadata
```

**Проверить статус подключения:**
```
GET http://localhost:8080/api/connection-status
```

### 6. Запустить клиент (если используется)

```bash
cd client
npm start
```

Откройте браузер: http://localhost:3000

## Структура новой БД PMU

**Таблица:** `pmu_measurements`

| Поле | Тип | Описание |
|------|-----|----------|
| time | TIMESTAMPTZ | Метка времени (первичный ключ) |
| current_value | DOUBLE PRECISION | Значение тока |
| voltage_value | DOUBLE PRECISION | Значение напряжения |

**Особенности TimescaleDB:**
- ✅ Автоматическое партиционирование по времени (chunks)
- ✅ Сжатие данных старше 7 дней
- ✅ Автоматическое удаление данных старше 30 дней
- ✅ Непрерывный агрегат для почасовой статистики
- ✅ Оптимизированные индексы для временных рядов

## Изменения в API

**Удалены endpoints:**
- ❌ POST /api/generation/start
- ❌ POST /api/generation/stop
- ❌ GET /api/generation/status

**Доступные endpoints:**
- ✅ GET /api/getparams - получить все измерения
- ✅ POST /api/execute-query - выполнить SQL запрос
- ✅ GET /api/metadata - метаданные БД
- ✅ POST /api/connect - переподключиться к БД
- ✅ GET /api/connection-status - статус подключения
- ✅ POST /api/deltable - удалить таблицу
- ✅ POST /api/addrow - добавить строку
- ✅ POST /api/delrow - удалить строку
- ✅ POST /api/updaterow - обновить строку
- ✅ POST /api/downldata - скачать данные
- ✅ POST /api/sqlquery - выполнить SQL запрос

**Новые функции в routes/generation.go:**
- ✅ GetLatestDataHandler - получить последние N записей
- ✅ GetDataHistoryHandler - получить данные за период
- ✅ GetAggregatedDataHandler - получить агрегированные данные (использует time_bucket TimescaleDB)

## Примечания

1. **Пароль БД:** В коде используется пароль "123". Если ваш пароль другой, измените его в:
   - `server/main.go` (строка 19)
   - `server/scripts/generate_test_data.go` (строка 25)

2. **Политики TimescaleDB:** В SQL скрипте включены политики сжатия и удаления данных. Если не хотите их использовать, закомментируйте соответствующие строки в `init_pmu.sql`.

3. **Клиентская часть:** Если клиент использовал WebSocket или endpoints генерации, потребуется обновить клиентский код.

4. **Backup:** Перед удалением старой БД "test" сделайте backup:
   ```bash
   pg_dump -U postgres test > backup_test.sql
   ```

## Полезные команды TimescaleDB

```sql
-- Информация о гипертаблице
SELECT * FROM timescaledb_information.hypertables;

-- Информация о chunks
SELECT * FROM timescaledb_information.chunks;

-- Статистика сжатия
SELECT * FROM timescaledb_information.compression_settings;

-- Размер таблицы
SELECT pg_size_pretty(pg_total_relation_size('pmu_measurements'));

-- Агрегированные данные за последний час
SELECT 
    time_bucket('1 minute', time) AS bucket,
    AVG(current_value) as avg_current,
    AVG(voltage_value) as avg_voltage
FROM pmu_measurements
WHERE time > NOW() - INTERVAL '1 hour'
GROUP BY bucket
ORDER BY bucket DESC;
```

## Поддержка

Если возникнут проблемы:
1. Проверьте логи сервера
2. Проверьте подключение к БД PMU
3. Убедитесь, что TimescaleDB установлен и включен
4. Проверьте, что таблица pmu_measurements создана и является гипертаблицей

Миграция завершена! 🎉
