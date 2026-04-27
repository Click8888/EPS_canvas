package main

import (
	"fmt"
	"log"
	"math"
	"math/rand"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type PMUMeasurement struct {
	Time         time.Time
	CurrentValue float64
	VoltageValue float64
}

func (PMUMeasurement) TableName() string {
	return "pmu_measurements"
}

func main() {
	// Подключение к БД PMU
	dsn := "host=localhost port=5432 user=postgres password=123 dbname=pmu sslmode=disable TimeZone=UTC"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Ошибка подключения к БД: %v", err)
	}

	fmt.Println("=== Генератор тестовых данных с чередующимися диапазонами ===")
	fmt.Println("Маленький диапазон (1-2): 20 секунд")
	fmt.Println("Большой диапазон (0-60): 20 секунд")
	fmt.Println("Нажмите Ctrl+C для остановки")
	fmt.Println()

	ticker := time.NewTicker(20 * time.Millisecond)
	defer ticker.Stop()

	count := 0

	// Инициализация генератора случайных чисел
	rand.Seed(time.Now().UnixNano())

	// Параметры диапазонов
	smallMin := 1.0
	smallMax := 2.0
	largeMin := 0.0
	largeMax := 60.0

	// Переменные для отслеживания переключения
	isSmallRange := true
	lastSwitch := time.Now()
	switchInterval := 5 * time.Second

	fmt.Printf(">>> Начало: МАЛЕНЬКИЙ ДИАПАЗОН (1-2)\n\n")

	for range ticker.C {
		// Проверка необходимости переключения диапазона
		if time.Since(lastSwitch) >= switchInterval {
			isSmallRange = !isSmallRange
			lastSwitch = time.Now()

			if isSmallRange {
				fmt.Printf("\n>>> Переключение: МАЛЕНЬКИЙ ДИАПАЗОН (1-2)\n\n")
			} else {
				fmt.Printf("\n>>> Переключение: БОЛЬШОЙ ДИАПАЗОН (0-60)\n\n")
			}
		}

		// Выбор текущего диапазона
		var minValue, maxValue float64
		var rangeLabel string

		if isSmallRange {
			minValue = smallMin
			maxValue = smallMax
			rangeLabel = "малый"
		} else {
			minValue = largeMin
			maxValue = largeMax
			rangeLabel = "большой"
		}

		rangeValue := maxValue - minValue

		// Генерация случайных значений в текущем диапазоне
		currentValue := rand.Float64()*rangeValue + minValue
		voltageValue := rand.Float64()*rangeValue + minValue

		measurement := PMUMeasurement{
			Time:         time.Now(),
			CurrentValue: math.Round(currentValue*1000) / 1000, // Округление до 3 знаков
			VoltageValue: math.Round(voltageValue*1000) / 1000, // Округление до 3 знаков
		}

		if err := db.Create(&measurement).Error; err != nil {
			log.Printf("Ошибка вставки: %v", err)
		} else {
			count++
			if count%50 == 0 { // Выводим каждую 50-ю запись
				fmt.Printf("[%d] [%s] time=%v, current=%.3f, voltage=%.3f\n",
					count,
					rangeLabel,
					measurement.Time.Format("15:04:05.000"),
					measurement.CurrentValue,
					measurement.VoltageValue)
			}
		}
	}
}
