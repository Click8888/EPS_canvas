package routes

import (
	"log"
	"math"
	"math/rand"
	"net/http"
	"sync"
	"time"

	"EPS/database"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"gorm.io/gorm"
)

var (
	generationMutex sync.Mutex
	isGenerating    bool
	stopGeneration  chan bool
	clients         = make(map[*websocket.Conn]bool)
	broadcast       = make(chan ChartData)
	upgrader        = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}
)

// Структуры данных
type GenerationStatus struct {
	IsGenerating bool   `json:"isGenerating"`
	Status       string `json:"status"`
	Message      string `json:"message"`
}

// Структура для данных графика
type ChartData struct {
	Type      string    `json:"type"`              // "current" или "voltage"
	Time      float64   `json:"time"`              // время в секундах с точкой отсчета
	Value     float64   `json:"value"`             // значение
	ChartID   string    `json:"chartId,omitempty"` // ID графика для фильтрации
	Timestamp time.Time `json:"timestamp"`         // реальное время
	Overload  bool      `json:"overload"`          // флаг перегрузки
}

// Структура для пакетной отправки данных
type ChartDataBatch struct {
	Type    string      `json:"type"`
	Data    []ChartData `json:"data"`
	ChartID string      `json:"chartId,omitempty"`
}

// CurrentMeasurement - структура для БД
type CurrentMeasurement struct {
	ID              int       `json:"id"`
	MeasurementTime time.Time `json:"measurement_time"`
	CurrentValue    float64   `json:"current_value"`
	VoltageValue    float64   `json:"voltage_value"`
	CircuitID       string    `json:"circuit_id"`
	SensorModel     string    `json:"sensor_model"`
	IsOverload      bool      `json:"is_overload"`
}

// WebSocketHandler для подключения клиентов
func WebSocketHandler(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}
	defer conn.Close()

	clients[conn] = true
	log.Printf("WebSocket client connected. Total clients: %d", len(clients))

	// Обработка сообщений от клиента
	for {
		messageType, p, err := conn.ReadMessage()
		if err != nil {
			delete(clients, conn)
			log.Printf("WebSocket client disconnected. Total clients: %d", len(clients))
			break
		}

		// Эхо-ответ для тестирования
		if err := conn.WriteMessage(messageType, p); err != nil {
			log.Printf("WebSocket write error: %v", err)
			break
		}
	}
}

// Broadcast data to all connected clients
func broadcastData() {
	for {
		data := <-broadcast
		for client := range clients {
			err := client.WriteJSON(data)
			if err != nil {
				log.Printf("WebSocket write error: %v", err)
				client.Close()
				delete(clients, client)
			}
		}
	}
}

// Запускаем broadcast горутину
func init() {
	go broadcastData()
}

// StartGenerationHandler запускает генерацию данных
func StartGenerationHandler(c *gin.Context) {
	generationMutex.Lock()
	defer generationMutex.Unlock()

	if isGenerating {
		c.JSON(http.StatusConflict, gin.H{
			"error": "Генерация уже запущена",
		})
		return
	}

	// Проверяем доступность БД
	if database.DB == nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Подключение к БД не инициализировано",
		})
		return
	}

	// Получаем настройки из запроса
	var request struct {
		Interval int    `json:"interval"` // интервал в мс
		ChartID  string `json:"chartId"`  // ID графика (опционально)
	}

	if err := c.BindJSON(&request); err != nil {
		request.Interval = 20 // по умолчанию 20мс
	}

	// Запускаем генерацию в отдельной горутине
	stopGeneration = make(chan bool)
	isGenerating = true

	go generateCurrentMeasurements(database.DB, stopGeneration, request.Interval, request.ChartID)

	c.JSON(http.StatusOK, gin.H{
		"message":  "Генерация данных запущена",
		"status":   "running",
		"interval": request.Interval,
	})
}

// StopGenerationHandler останавливает генерацию данных
func StopGenerationHandler(c *gin.Context) {
	generationMutex.Lock()
	defer generationMutex.Unlock()

	if !isGenerating {
		c.JSON(http.StatusConflict, gin.H{
			"error": "Генерация не запущена",
		})
		return
	}

	// Отправляем сигнал остановки
	close(stopGeneration)
	isGenerating = false

	c.JSON(http.StatusOK, gin.H{
		"message": "Генерация данных остановлена",
		"status":  "stopped",
	})
}

// GenerationStatusHandler возвращает статус генерации
func GenerationStatusHandler(c *gin.Context) {
	generationMutex.Lock()
	defer generationMutex.Unlock()

	status := "stopped"
	if isGenerating {
		status = "running"
	}

	c.JSON(http.StatusOK, gin.H{
		"isGenerating": isGenerating,
		"status":       status,
		"clients":      len(clients),
		"message":      "Текущий статус генерации",
	})
}

// GetLatestDataHandler возвращает последние данные
func GetLatestDataHandler(c *gin.Context) {
	var request struct {
		Limit   int    `form:"limit" binding:"required"`
		Type    string `form:"type"`    // "current" или "voltage"
		ChartID string `form:"chartId"` // ID графика
	}

	if err := c.ShouldBindQuery(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if request.Limit > 1000 {
		request.Limit = 1000
	}

	// Запрос к БД
	var measurements []CurrentMeasurement
	result := database.DB.Table("current_measurements").
		Order("measurement_time DESC").
		Limit(request.Limit).
		Find(&measurements)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	// Преобразуем в формат для графика
	var chartData []ChartData
	startTime := time.Now()

	for i := len(measurements) - 1; i >= 0; i-- {
		m := measurements[i]

		// Вычисляем время в секундах относительно начала
		timeSinceStart := startTime.Sub(m.MeasurementTime).Seconds()
		timeValue := math.Abs(timeSinceStart)

		// Ток
		if request.Type == "" || request.Type == "current" {
			chartData = append(chartData, ChartData{
				Type:      "current",
				Time:      timeValue,
				Value:     m.CurrentValue,
				ChartID:   request.ChartID,
				Timestamp: m.MeasurementTime,
				Overload:  m.IsOverload,
			})
		}

		// Напряжение
		if request.Type == "" || request.Type == "voltage" {
			chartData = append(chartData, ChartData{
				Type:      "voltage",
				Time:      timeValue,
				Value:     m.VoltageValue,
				ChartID:   request.ChartID,
				Timestamp: m.MeasurementTime,
				Overload:  m.IsOverload,
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"data":    chartData,
		"count":   len(chartData),
		"type":    request.Type,
		"chartId": request.ChartID,
	})
}

// Функция генерации данных
func generateCurrentMeasurements(db *gorm.DB, stopChan chan bool, interval int, chartID string) {
	ticker := time.NewTicker(time.Duration(interval) * time.Millisecond)
	defer ticker.Stop()

	// Начальное время для относительного отсчета
	startTime := time.Now()

	// Счетчик для уникальных временных меток
	timeCounter := 0.0


	for {
		select {
		case <-stopChan:
			log.Println("Генерация данных остановлена")
			return
		case <-ticker.C:
			// Увеличиваем счетчик времени
			elapsed := time.Since(startTime)
			timeInSeconds := elapsed.Seconds()

			// Генерация данных
			data := generateDataPoint(timeCounter, timeInSeconds)
			timeCounter += float64(interval) / 1000.0 // Увеличиваем на интервал в секундах

			// Создаем данные для графика с корректным временем
			currentData := ChartData{
				Type:      "current",
				Time:      timeInSeconds, // Используем реальное прошедшее время
				Value:     data.CurrentValue,
				ChartID:   chartID,
				Timestamp: data.MeasurementTime,
				Overload:  data.IsOverload,
			}

			voltageData := ChartData{
				Type:      "voltage",
				Time:      timeInSeconds, // Такое же время для синхронизации
				Value:     data.VoltageValue,
				ChartID:   chartID,
				Timestamp: data.MeasurementTime,
				Overload:  data.IsOverload,
			}

			// Отправляем через WebSocket
			broadcast <- currentData
			broadcast <- voltageData

			// Вставка в базу данных
			err := insertData(db, data)
			if err != nil {
				log.Printf("Ошибка вставки данных: %v", err)
			}

		}
	}
}

// Функция генерации точки данных (без изменений, но добавлены комментарии)
func generateDataPoint(counter float64, timeInSeconds float64) CurrentMeasurement {
	now := time.Now()
	isOverload := false
	var currentVal float64
	var voltageVal float64

	// Инициализируем генератор случайных чисел с seed на основе времени
	rand.Seed(now.UnixNano())

	// Аномальные значения тока (перегрузки)
	currentOverloadValues := []float64{9.123, 0.045, 8.765, 0.123, 7.891, 0.234, 10.456, 0.067}
	// Аномальные значения напряжения (скачки/просадки)
	voltageOverloadValues := []float64{0.5, 15.0, 0.1, 18.0, 0.05, 20.0, 0.01, 25.0}

	// Основные диапазоны
	baseMinCurrent := 1.8
	baseMaxCurrent := 2.6
	baseMinVoltage := 2.0
	baseMaxVoltage := 10.0

	// Используем синусоидальный паттерн для создания реалистичных данных
	// Частота в герцах (сколько полных циклов в секунду)
	frequencyCurrent := 0.5 // 0.5 Гц = один цикл каждые 2 секунды
	frequencyVoltage := 0.3 // 0.3 Гц = один цикл каждые ~3.3 секунды

	// Базовое значение с синусоидальным изменением
	baseCurrent := (baseMinCurrent+baseMaxCurrent)/2 +
		math.Sin(2*math.Pi*frequencyCurrent*timeInSeconds)*0.4

	baseVoltage := (baseMinVoltage+baseMaxVoltage)/2 +
		math.Sin(2*math.Pi*frequencyVoltage*timeInSeconds)*3.0

	// Определяем, будет ли это перегрузка (примерно каждые 5 секунд)
	overloadPeriod := 5.0 // секунды
	overloadPhase := math.Mod(timeInSeconds, overloadPeriod*2)

	// Перегрузка происходит в определенные фазы
	if overloadPhase >= overloadPeriod-0.5 && overloadPhase < overloadPeriod+0.5 {
		isOverload = true
		// Выбираем случайное аномальное значение
		overloadIndex := int(math.Mod(float64(int(counter)), float64(len(currentOverloadValues))))
		currentVal = currentOverloadValues[overloadIndex]
		voltageVal = voltageOverloadValues[overloadIndex]
	} else {
		// Нормальные значения с шумом
		// Ток с небольшими флуктуациями
		currentNoise := (rand.Float64() - 0.5) * 0.1
		// Добавляем небольшие всплески каждые ~0.5 секунды
		spikeChance := math.Sin(2 * math.Pi * 2 * timeInSeconds)
		if spikeChance > 0.9 && rand.Float64() < 0.3 {
			currentNoise += rand.Float64() * 0.2
		}

		currentVal = baseCurrent + currentNoise

		// Напряжение с более плавными изменениями
		voltageNoise := (rand.Float64() - 0.5) * 0.2
		// Добавляем тренд на основе времени
		trend := math.Sin(2*math.Pi*0.1*timeInSeconds) * 0.5

		voltageVal = baseVoltage + voltageNoise + trend

		// Гауссовский шум
		currentVal += rand.NormFloat64() * 0.02
		voltageVal += rand.NormFloat64() * 0.05
	}

	// Гарантируем границы значений
	currentVal = math.Max(baseMinCurrent-0.5, math.Min(baseMaxCurrent+0.5, currentVal))
	voltageVal = math.Max(baseMinVoltage-1.0, math.Min(baseMaxVoltage+1.0, voltageVal))

	// Округляем значения
	currentVal = math.Round(currentVal*1000) / 1000
	voltageVal = math.Round(voltageVal*1000) / 1000

	// Дополнительная логика для интересных паттернов
	// Каждые 30 секунд добавляем особый паттерн
	if math.Mod(timeInSeconds, 30) < 2 {
		// Паттерн "пила"
		sawtooth := math.Mod(timeInSeconds, 2) / 2
		currentVal = baseMinCurrent + (baseMaxCurrent-baseMinCurrent)*sawtooth
		voltageVal = baseMinVoltage + (baseMaxVoltage-baseMinVoltage)*(1-sawtooth)
	}

	// Каждые 45 секунд - синусоидальный паттерн
	if math.Mod(timeInSeconds, 45) < 5 {
		fastSine := math.Sin(2*math.Pi*5*timeInSeconds) * 0.3
		currentVal += fastSine
		voltageVal -= fastSine * 2
	}

	return CurrentMeasurement{
		ID:              int(counter),
		MeasurementTime: now,
		CurrentValue:    currentVal,
		VoltageValue:    voltageVal,
		CircuitID:       "circuit_B",
		SensorModel:     "I-Sensor-Pro",
		IsOverload:      isOverload,
	}
}

// Вставка данных в БД - ИСПРАВЛЕННАЯ ВЕРСИЯ
func insertData(db *gorm.DB, data CurrentMeasurement) error {
    // Форматируем время в строку, которая точно поместится в 30 символов
    timeStr := data.MeasurementTime.Format("2006-01-02 15:04:05.999")
    
    measurement := map[string]interface{}{
        "measurement_time": timeStr, // Только как строка
        "current_value":    data.CurrentValue,
        "voltage_value":    data.VoltageValue,
        "circuit_id":       data.CircuitID,
        "sensor_model":     data.SensorModel,
        "is_overload":      data.IsOverload,
    }

    result := db.Table("current_measurements").Create(measurement)
    
    if result.Error != nil {
        // Альтернативный подход с более простым SQL
        sql := `INSERT INTO current_measurements 
                (measurement_time, current_value, voltage_value, circuit_id, sensor_model, is_overload) 
                VALUES (?, ?, ?, ?, ?, ?)`
        
        result = db.Exec(sql, timeStr, data.CurrentValue, data.VoltageValue,
            data.CircuitID, data.SensorModel, data.IsOverload)
    }

    return result.Error
}

// API для получения истории данных
func GetDataHistoryHandler(c *gin.Context) {
	var request struct {
		StartTime string `form:"startTime"`
		EndTime   string `form:"endTime"`
		Limit     int    `form:"limit"`
		Type      string `form:"type"`
		ChartID   string `form:"chartId"`
	}

	if err := c.ShouldBindQuery(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if request.Limit == 0 {
		request.Limit = 1000
	}
	if request.Limit > 5000 {
		request.Limit = 5000
	}

	// Парсим время
	var startTime, endTime time.Time
	var err error

	if request.StartTime != "" {
		startTime, err = time.Parse(time.RFC3339, request.StartTime)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный формат startTime"})
			return
		}
	}

	if request.EndTime != "" {
		endTime, err = time.Parse(time.RFC3339, request.EndTime)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный формат endTime"})
			return
		}
	}

	// Запрос к БД
	dbQuery := database.DB.Table("current_measurements")

	if !startTime.IsZero() {
		dbQuery = dbQuery.Where("measurement_time >= ?", startTime)
	}
	if !endTime.IsZero() {
		dbQuery = dbQuery.Where("measurement_time <= ?", endTime)
	}

	var measurements []CurrentMeasurement
	result := dbQuery.
		Order("measurement_time ASC").
		Limit(request.Limit).
		Find(&measurements)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	// Преобразуем в формат для графика
	var chartData []ChartData
	referenceTime := time.Now()

	for _, m := range measurements {
		// Время в секундах относительно текущего момента
		timeDiff := referenceTime.Sub(m.MeasurementTime).Seconds()

		if request.Type == "" || request.Type == "current" {
			chartData = append(chartData, ChartData{
				Type:      "current",
				Time:      math.Abs(timeDiff),
				Value:     m.CurrentValue,
				ChartID:   request.ChartID,
				Timestamp: m.MeasurementTime,
				Overload:  m.IsOverload,
			})
		}

		if request.Type == "" || request.Type == "voltage" {
			chartData = append(chartData, ChartData{
				Type:      "voltage",
				Time:      math.Abs(timeDiff),
				Value:     m.VoltageValue,
				ChartID:   request.ChartID,
				Timestamp: m.MeasurementTime,
				Overload:  m.IsOverload,
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"data":    chartData,
		"count":   len(chartData),
		"type":    request.Type,
		"chartId": request.ChartID,
	})
}