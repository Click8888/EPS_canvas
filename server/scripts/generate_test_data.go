package main

import (
	"fmt"
	"log"
	"math"
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
	dsn := "host=localhost port=5432 user=postgres password=antivzlom dbname=pmu sslmode=disable TimeZone=UTC"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Ошибка подключения к БД: %v", err)
	}

	fmt.Println("=== Генератор тестовых данных для PMU ===")
	fmt.Println("Нажмите Ctrl+C для остановки")
	fmt.Println()

	ticker := time.NewTicker(20 * time.Millisecond)
	defer ticker.Stop()

	startTime := time.Now()
	count := 0

	for range ticker.C {
		elapsed := time.Since(startTime).Seconds()

		// Генерация синусоидальных значений
		currentValue := 2.0*math.Sin(2*math.Pi*0.5*elapsed) + 2.0
		voltageValue := 4.0*math.Sin(2*math.Pi*0.3*elapsed) + 6.0

		measurement := PMUMeasurement{
			Time:         time.Now(),
			CurrentValue: math.Round(currentValue*1000) / 1000,
			VoltageValue: math.Round(voltageValue*1000) / 1000,
		}

		if err := db.Create(&measurement).Error; err != nil {
			log.Printf("Ошибка вставки: %v", err)
		} else {
			count++
			if count%50 == 0 { // Выводим каждую 50-ю запись
				fmt.Printf("[%d] time=%v, current=%.3f, voltage=%.3f\n",
					count,
					measurement.Time.Format("15:04:05.000"),
					measurement.CurrentValue,
					measurement.VoltageValue)
			}
		}
	}
}
