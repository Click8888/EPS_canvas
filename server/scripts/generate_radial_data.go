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

// Структура для таблицы radial
type RadialMeasurement struct {
	Time   time.Time
	Angle  float64
	Lenght float64 // Обратите внимание: в БД поле называется "lenght" (с опечаткой)
}

func (RadialMeasurement) TableName() string {
	return "radial"
}

func main() {
	// Подключение к БД PMU
	dsn := "host=localhost port=5432 user=postgres password=123 dbname=pmu sslmode=disable TimeZone=UTC"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Ошибка подключения к БД: %v", err)
	}

	fmt.Println("=== Генератор данных для таблицы radial ===")
	fmt.Println("Угол: колеблется незначительно, меняется каждые 5 секунд")
	fmt.Println("Длина: синусоида с шумом в диапазоне (-50, 50)")
	fmt.Println("Частота: каждые 20 миллисекунд")
	fmt.Println("Нажмите Ctrl+C для остановки")
	fmt.Println()

	// Инициализация генератора случайных чисел
	rand.Seed(time.Now().UnixNano())

	// Ticker для генерации данных каждые 20ms
	ticker := time.NewTicker(20 * time.Millisecond)
	defer ticker.Stop()

	// Переменные для генерации угла
	baseAngle := rand.Float64() * 360.0        // Начальный базовый угол (0-360°)
	lastAngleSwitch := time.Now()              // Время последней смены базового угла
	angleSwitchInterval := 5 * time.Second     // Интервал смены базового угла

	// Переменные для генерации длины (синусоида)
	startTime := time.Now()                    // Начальное время для синусоиды
	frequency := 0.1                           // Частота синусоиды в Hz (период 10 секунд)

	count := 0

	fmt.Printf(">>> Начальный базовый угол: %.2f°\n\n", baseAngle)

	for range ticker.C {
		// ========== ГЕНЕРАЦИЯ УГЛА ==========
		
		// Проверка необходимости смены базового угла (каждые 5 секунд)
		if time.Since(lastAngleSwitch) >= angleSwitchInterval {
			baseAngle = rand.Float64() * 360.0
			lastAngleSwitch = time.Now()
			fmt.Printf("\n>>> Смена базового угла: %.2f°\n\n", baseAngle)
		}

		// Добавляем небольшие колебания к базовому углу (±10°)
		angleNoise := (rand.Float64() - 0.5) * 20.0 // Диапазон: -10° до +10°
		angle := baseAngle + angleNoise

		// Нормализация угла в диапазон 0-360°
		for angle < 0 {
			angle += 360.0
		}
		for angle >= 360.0 {
			angle -= 360.0
		}

		// ========== ГЕНЕРАЦИЯ ДЛИНЫ ==========
		
		// Вычисляем время с начала работы скрипта
		elapsedTime := time.Since(startTime).Seconds()

		// Синусоидальное значение
		sinValue := math.Sin(2 * math.Pi * frequency * elapsedTime)

		// Базовая длина от -50 до 50
		baseLength := 50.0 * sinValue

		// Добавляем случайный шум ±10% (±5 единиц)
		noiseAmplitude := 5.0
		noise := (rand.Float64() - 0.5) * 2.0 * noiseAmplitude
		lenght := baseLength + noise

		// Ограничиваем диапазон [-50, 50]
		if lenght > 50.0 {
			lenght = 50.0
		} else if lenght < -50.0 {
			lenght = -50.0
		}

		// Округление до 3 знаков после запятой
		angle = math.Round(angle*1000) / 1000
		lenght = math.Round(lenght*1000) / 1000

		// ========== СОЗДАНИЕ И ВСТАВКА ЗАПИСИ ==========
		
		measurement := RadialMeasurement{
			Time:   time.Now(),
			Angle:  angle,
			Lenght: lenght,
		}

		if err := db.Create(&measurement).Error; err != nil {
			log.Printf("Ошибка вставки: %v", err)
		} else {
			count++
			// Выводим каждую 50-ю запись для мониторинга
			if count%50 == 0 {
				fmt.Printf("[%d] time=%v, angle=%.3f°, lenght=%.3f (base_angle=%.2f°)\n",
					count,
					measurement.Time.Format("15:04:05.000"),
					measurement.Angle,
					measurement.Lenght,
					baseAngle)
			}
		}
	}
}