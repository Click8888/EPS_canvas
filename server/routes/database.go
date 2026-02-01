package routes

import (
	"EPS/database"
	"EPS/models"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func GetDatabases(c *gin.Context) {

	// userID := c.MustGet("userID").(uint) // Получаем ID пользователя из middleware

	var databases []models.Current_measurements
	if err := database.DB.Find(&databases).Error; err != nil { //запись данных из БД в переменную databases
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch databases"})
		return
	}

	// Формируем ответ с дополнительной информацией
	type Measurements struct {
		ID               uint
		Measurement_time string
		Current_value    float32
		Voltage_value    float32
		Circuit_id       string
		Sensor_model     string
		Is_overload      bool
	}

	var result []Measurements
	for _, db := range databases {
		// var creator models.User
		// database.DB.First(&creator, db.ID_creator)

		result = append(result, Measurements{
			ID:               db.ID,
			Measurement_time: db.Measurement_time,
			Current_value:    db.Current_value,
			Voltage_value:    db.Voltage_value,
		})

	}

	c.JSON(http.StatusOK, gin.H{"databases": result})

}

func HandleSQLQuery(c *gin.Context) {

	var request struct {
		Query string `json:"Sql"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})

		return
	}

	// Проверяем, что запрос не пустой
	if request.Query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "SQL query is required"})
		return
	}

	// Ограничиваем только SELECT запросы для безопасности
	trimmedQuery := strings.TrimSpace(request.Query)
	if !strings.HasPrefix(strings.ToUpper(trimmedQuery), "SELECT") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only SELECT queries are allowed"})
		return
	}

	// Выполняем SQL запрос и получаем результат в виде map
	var results []map[string]interface{}
	err := database.DB.Raw(request.Query).Scan(&results).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to execute query: " + err.Error()})
		return
	}

	// Возвращаем результаты
	c.JSON(http.StatusOK, gin.H{
		"data": results,
		"count": len(results),
	})

}
