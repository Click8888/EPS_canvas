package routes

import (
	"log"
	"math"
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
	Time      float64   `json:"time"`              // время в секундах с точки отсчета
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

	go generateSineWaveData(database.DB, stopGeneration, request.Interval, request.ChartID)

	c.JSON(http.StatusOK, gin.H{
		"message":  "Генерация синусоиды запущена",
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

// Функция генерации синусоидальных данных
func generateSineWaveData(db *gorm.DB, stopChan chan bool, interval int, chartID string) {
	ticker := time.NewTicker(time.Duration(interval) * time.Millisecond)
	defer ticker.Stop()

	// Начальное время для относительного отсчета
	startTime := time.Now()

	// Параметры синусоид
	currentAmplitude := 2.0      // Амплитуда тока
	currentFrequency := 0.5      // Частота тока (0.5 Гц)
	currentOffset := 2.0         // Смещение тока
	
	voltageAmplitude := 4.0      // Амплитуда напряжения
	voltageFrequency := 0.3      // Частота напряжения (0.3 Гц)
	voltageOffset := 6.0         // Смещение напряжения

	for {
		select {
		case <-stopChan:
			log.Println("Генерация синусоиды остановлена")
			return
		case <-ticker.C:
			// Текущее время в секундах от начала генерации
			elapsed := time.Since(startTime)
			timeInSeconds := elapsed.Seconds()

			// Генерация синусоидальных значений
			currentValue := currentAmplitude*math.Sin(2*math.Pi*currentFrequency*timeInSeconds) + currentOffset
			voltageValue := voltageAmplitude*math.Sin(2*math.Pi*voltageFrequency*timeInSeconds) + voltageOffset

			// Округляем до 3 знаков
			currentValue = math.Round(currentValue*1000) / 1000
			voltageValue = math.Round(voltageValue*1000) / 1000

			// Создаем данные для графика
			currentData := ChartData{
				Type:      "current",
				Time:      timeInSeconds,
				Value:     currentValue,
				ChartID:   chartID,
				Timestamp: time.Now(),
				Overload:  false,
			}

			voltageData := ChartData{
				Type:      "voltage",
				Time:      timeInSeconds,
				Value:     voltageValue,
				ChartID:   chartID,
				Timestamp: time.Now(),
				Overload:  false,
			}

			// Отправляем через WebSocket
			broadcast <- currentData
			broadcast <- voltageData

			// Сохраняем в БД
			measurement := CurrentMeasurement{
				MeasurementTime: time.Now(),
				CurrentValue:    currentValue,
				VoltageValue:    voltageValue,
				CircuitID:       "circuit_B",
				SensorModel:     "I-Sensor-Pro",
				IsOverload:      false,
			}

			err := insertData(db, measurement)
			if err != nil {
				log.Printf("Ошибка вставки данных: %v", err)
			}
		}
	}
}

// Вставка данных в БД
func insertData(db *gorm.DB, data CurrentMeasurement) error {
	// Форматируем время в строку
	timeStr := data.MeasurementTime.UTC().Format(time.RFC3339Nano)
	
	measurement := map[string]interface{}{
		"measurement_time": timeStr,
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