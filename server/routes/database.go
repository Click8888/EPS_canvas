package routes

import (
	"EPS/database"
	"EPS/models"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func GetDatabases(c *gin.Context) {
    var measurements []models.PMUMeasurement
    if err := database.DB.Find(&measurements).Error; err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch measurements"})
        return
    }

    // Формируем ответ
    type MeasurementResponse struct {
        Time         string  `json:"time"`
        CurrentValue float64 `json:"current_value"`
        VoltageValue float64 `json:"voltage_value"`
    }

    var result []MeasurementResponse
    for _, m := range measurements {
        result = append(result, MeasurementResponse{
            Time:         m.Time.Format("2006-01-02 15:04:05.000"),
            CurrentValue: m.CurrentValue,
            VoltageValue: m.VoltageValue,
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
