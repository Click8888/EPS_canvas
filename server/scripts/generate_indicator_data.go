package main

// Тестовый генератор для узлов-индикаторов.
//
// Что делает:
//   * при КАЖДОМ запуске пересоздаёт таблицу indicator_test (DROP + CREATE);
//   * создаёт 20 переменных var1..var20;
//   * сразу пишет стартовую строку, затем каждые 10 секунд добавляет новую;
//   * каждая переменная переключается между 0 и 1, соседние — в противофазе
//     (var_i = (state+i) % 2), поэтому в любой момент половина «горит», половина
//     погашена, и все разом переключаются раз в 10 секунд.
//
// Запуск (из каталога server):
//   go run scripts/generate_indicator_data.go
//
// В приложении: добавить «Индикатор», выбрать таблицу indicator_test и нужные
// столбцы (var1..var20), задать состояния 0 → красный, 1 → зелёный и включить ▶.

import (
	"fmt"
	"log"
	"strings"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Число переменных.
const varCount = 20

func main() {
	// Те же параметры подключения, что и у сервера (main.go).
	dsn := "host=localhost port=5432 user=postgres password=123 dbname=pmu sslmode=disable TimeZone=UTC"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		log.Fatalf("Ошибка подключения к БД: %v", err)
	}

	// Имена столбцов var1..varN.
	cols := make([]string, varCount)
	for i := 0; i < varCount; i++ {
		cols[i] = fmt.Sprintf("var%d", i+1)
	}

	// Пересоздаём таблицу при каждом запуске скрипта.
	// Первый столбец — time: индикатор берёт последнюю строку через ORDER BY 1 DESC.
	if err := db.Exec(`DROP TABLE IF EXISTS indicator_test`).Error; err != nil {
		log.Fatalf("Не удалось удалить таблицу: %v", err)
	}
	var defs strings.Builder
	for _, c := range cols {
		defs.WriteString(fmt.Sprintf(",\n\t\t\t%s INTEGER NOT NULL", c))
	}
	createSQL := fmt.Sprintf("CREATE TABLE indicator_test (\n\t\t\ttime TIMESTAMPTZ NOT NULL%s\n\t\t)", defs.String())
	if err := db.Exec(createSQL).Error; err != nil {
		log.Fatalf("Не удалось создать таблицу: %v", err)
	}

	// Готовим INSERT с плейсхолдерами: time + varCount значений.
	placeholders := strings.TrimSuffix(strings.Repeat("?, ", varCount+1), ", ")
	insertSQL := fmt.Sprintf(
		"INSERT INTO indicator_test (time, %s) VALUES (%s)",
		strings.Join(cols, ", "), placeholders,
	)

	fmt.Println("=== Тестовый генератор для индикаторов ===")
	fmt.Printf("Таблица indicator_test пересоздана: %d переменных (var1..var%d).\n", varCount, varCount)
	fmt.Println("Значения переключаются 0<->1 каждые 10 секунд (соседние в противофазе).")
	fmt.Println("Нажмите Ctrl+C для остановки.")
	fmt.Println()

	state := 0

	// Одна вставка: var_i = (state + i) % 2.
	write := func() {
		args := make([]interface{}, 0, varCount+1)
		args = append(args, time.Now())
		pattern := make([]byte, varCount)
		for i := 0; i < varCount; i++ {
			v := (state + i) % 2
			args = append(args, v)
			pattern[i] = byte('0' + v)
		}
		if err := db.Exec(insertSQL, args...).Error; err != nil {
			log.Printf("Ошибка вставки: %v", err)
			return
		}
		fmt.Printf("[%s] %s\n", time.Now().Format("15:04:05"), string(pattern))
	}

	// Стартовое значение — сразу, чтобы индикаторы ожили без ожидания первых 10 секунд.
	write()
	state ^= 1

	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		write()
		state ^= 1
	}
}
