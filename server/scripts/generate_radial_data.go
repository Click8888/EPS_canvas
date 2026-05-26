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
	Lenght float64 // В БД поле называется "lenght"
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

	fmt.Println("=== Генератор данных для таблицы radial (стабильная версия) ===")
	fmt.Println("Угол: 15 сек колеблется в пределах ±1°, затем сдвиг на 8-10°")
	fmt.Println("Длина: медленная синусоида в диапазоне (35-50) с минимальным шумом")
	fmt.Println("Частота: каждые 20 миллисекунд")
	fmt.Println("Нажмите Ctrl+C для остановки")
	fmt.Println()

	// Инициализация генератора случайных чисел
	rand.Seed(time.Now().UnixNano())

	// Ticker для генерации данных каждые 20ms
	ticker := time.NewTicker(20 * time.Millisecond)
	defer ticker.Stop()

	// ========== ПАРАМЕТРЫ ГЕНЕРАЦИИ УГЛА ==========
	baseAngle := rand.Float64() * 360.0        // Начальный базовый угол (0-360°)
	lastAngleShift := time.Now()               // Время последнего сдвига угла
	angleStableDuration := 15 * time.Second    // Длительность стабильного периода
	angleShiftAmount := 8.0 + rand.Float64()*2.0 // Величина сдвига (8-10 градусов)
	
	// ========== ПАРАМЕТРЫ ГЕНЕРАЦИИ ДЛИНЫ ==========
	startTime := time.Now()
	frequency := 0.05                           // Очень низкая частота (период 20 секунд)
	lengthMin := 35.0                           // Минимальная длина
	lengthMax := 50.0                           // Максимальная длина
	lengthAmplitude := (lengthMax - lengthMin) / 2 // Амплитуда синусоиды (7.5)
	lengthOffset := (lengthMax + lengthMin) / 2    // Смещение (42.5)

	count := 0

	fmt.Printf(">>> Начальный базовый угол: %.2f°\n", baseAngle)
	fmt.Printf(">>> Диапазон длины: [%.1f, %.1f]\n", lengthMin, lengthMax)
	fmt.Printf(">>> Величина сдвига угла: %.1f°\n\n", angleShiftAmount)

	for range ticker.C {
		// ========== ГЕНЕРАЦИЯ УГЛА ==========
		
		// Проверка необходимости сдвига базового угла (каждые 15 секунд)
		if time.Since(lastAngleShift) >= angleStableDuration {
			// Случайное направление сдвига (влево или вправо)
			direction := 1.0
			if rand.Float64() < 0.5 {
				direction = -1.0
			}
			
			// Новая величина сдвига для следующего раза
			angleShiftAmount = 8.0 + rand.Float64()*2.0
			
			// Применяем сдвиг
			baseAngle += direction * angleShiftAmount
			lastAngleShift = time.Now()
			
			// Нормализация угла
			for baseAngle < 0 {
				baseAngle += 360.0
			}
			for baseAngle >= 360.0 {
				baseAngle -= 360.0
			}
			
			fmt.Printf("\n>>> Сдвиг угла на %+.1f° (новый базовый угол: %.2f°)\n\n",
				direction*angleShiftAmount, baseAngle)
		}

		// Добавляем очень маленькие колебания к базовому углу (±1°)
		angleNoise := (rand.Float64() - 0.5) * 2.0 // Диапазон: -1° до +1°
		angle := baseAngle + angleNoise

		// Нормализация угла в диапазон 0-360°
		for angle < 0 {
			angle += 360.0
		}
		for angle >= 360.0 {
			angle -= 360.0
		}

		// ========== ГЕНЕРАЦИЯ ДЛИНЫ ==========
		
		// Время с начала работы
		elapsedTime := time.Since(startTime).Seconds()

		// Медленная синусоида в диапазоне [35, 50]
		sinValue := math.Sin(2 * math.Pi * frequency * elapsedTime)
		baseLength := lengthOffset + lengthAmplitude*sinValue

		// Добавляем очень маленький шум (±0.5 единиц)
		noiseAmplitude := 0.5
		noise := (rand.Float64() - 0.5) * 2.0 * noiseAmplitude
		lenght := baseLength + noise

		// Мягкое ограничение диапазона
		if lenght > lengthMax {
			lenght = lengthMax
		} else if lenght < lengthMin {
			lenght = lengthMin
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
				timeSinceShift := time.Since(lastAngleShift).Seconds()
				fmt.Printf("[%d] time=%v, angle=%.3f° (стабилен %.1f/15с), length=%.3f (sin=%.3f)\n",
					count,
					measurement.Time.Format("15:04:05.000"),
					measurement.Angle,
					timeSinceShift,
					measurement.Lenght,
					sinValue)
			}
		}
	}
}