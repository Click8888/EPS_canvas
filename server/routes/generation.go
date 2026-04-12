package routes

import (
	"EPS/database"
	"EPS/models"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// Структура для данных графика
type ChartData struct {
	Type      string    `json:"type"`
	Time      string    `json:"time"`
	Value     float64   `json:"value"`
	Timestamp time.Time `json:"timestamp"`
}

// GetLatestDataHandler возвращает последние данные из БД PMU
func GetLatestDataHandler(c *gin.Context) {
	var request struct {
		Limit int    `form:"limit" binding:"required"`
		Type  string `form:"type"` // "current" или "voltage"
	}

	if err := c.ShouldBindQuery(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if request.Limit > 1000 {
		request.Limit = 1000
	}

	// Запрос к БД PMU
	var measurements []models.PMUMeasurement
	result := database.DB.
		Order("time DESC").
		Limit(request.Limit).
		Find(&measurements)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	// Преобразуем в формат для графика
	var chartData []ChartData

	for i := len(measurements) - 1; i >= 0; i-- {
		m := measurements[i]

		// Ток
		if request.Type == "" || request.Type == "current" {
			chartData = append(chartData, ChartData{
				Type:      "current",
				Time:      m.Time.Format("2006-01-02 15:04:05.000"),
				Value:     m.CurrentValue,
				Timestamp: m.Time,
			})
		}

		// Напряжение
		if request.Type == "" || request.Type == "voltage" {
			chartData = append(chartData, ChartData{
				Type:      "voltage",
				Time:      m.Time.Format("2006-01-02 15:04:05.000"),
				Value:     m.VoltageValue,
				Timestamp: m.Time,
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  chartData,
		"count": len(chartData),
		"type":  request.Type,
	})
}

// GetDataHistoryHandler возвращает исторические данные за период
func GetDataHistoryHandler(c *gin.Context) {
	var request struct {
		StartTime string `form:"startTime"`
		EndTime   string `form:"endTime"`
		Limit     int    `form:"limit"`
		Type      string `form:"type"`
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

	// Запрос к БД PMU
	dbQuery := database.DB.Model(&models.PMUMeasurement{})

	if !startTime.IsZero() {
		dbQuery = dbQuery.Where("time >= ?", startTime)
	}
	if !endTime.IsZero() {
		dbQuery = dbQuery.Where("time <= ?", endTime)
	}

	var measurements []models.PMUMeasurement
	result := dbQuery.
		Order("time ASC").
		Limit(request.Limit).
		Find(&measurements)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	// Преобразуем в формат для графика
	var chartData []ChartData

	for _, m := range measurements {
		if request.Type == "" || request.Type == "current" {
			chartData = append(chartData, ChartData{
				Type:      "current",
				Time:      m.Time.Format("2006-01-02 15:04:05.000"),
				Value:     m.CurrentValue,
				Timestamp: m.Time,
			})
		}

		if request.Type == "" || request.Type == "voltage" {
			chartData = append(chartData, ChartData{
				Type:      "voltage",
				Time:      m.Time.Format("2006-01-02 15:04:05.000"),
				Value:     m.VoltageValue,
				Timestamp: m.Time,
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  chartData,
		"count": len(chartData),
		"type":  request.Type,
	})
}

// GetAggregatedDataHandler возвращает агрегированные данные (использует возможности TimescaleDB)
func GetAggregatedDataHandler(c *gin.Context) {
	var request struct {
		StartTime string `form:"startTime" binding:"required"`
		EndTime   string `form:"endTime" binding:"required"`
		Interval  string `form:"interval"` // '1 minute', '1 hour', '1 day', '1 week'
	}

	if err := c.ShouldBindQuery(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if request.Interval == "" {
		request.Interval = "1 hour"
	}

	// Парсим время
	startTime, err := time.Parse(time.RFC3339, request.StartTime)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный формат startTime"})
		return
	}

	endTime, err := time.Parse(time.RFC3339, request.EndTime)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный формат endTime"})
		return
	}

	// Используем time_bucket для агрегации (функция TimescaleDB)
	query := `
		SELECT 
			time_bucket(?, time) AS bucket,
			AVG(current_value) as avg_current,
			AVG(voltage_value) as avg_voltage,
			MAX(current_value) as max_current,
			MAX(voltage_value) as max_voltage,
			MIN(current_value) as min_current,
			MIN(voltage_value) as min_voltage,
			COUNT(*) as count
		FROM pmu_measurements
		WHERE time >= ? AND time <= ?
		GROUP BY bucket
		ORDER BY bucket ASC
	`

	type AggregatedData struct {
		Bucket     time.Time `json:"bucket"`
		AvgCurrent float64   `json:"avg_current"`
		AvgVoltage float64   `json:"avg_voltage"`
		MaxCurrent float64   `json:"max_current"`
		MaxVoltage float64   `json:"max_voltage"`
		MinCurrent float64   `json:"min_current"`
		MinVoltage float64   `json:"min_voltage"`
		Count      int       `json:"count"`
	}

	var results []AggregatedData
	err = database.DB.Raw(query, request.Interval, startTime, endTime).Scan(&results).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":     results,
		"count":    len(results),
		"interval": request.Interval,
	})
}