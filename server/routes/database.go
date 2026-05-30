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

// HandleSQLQueryBatch выполняет несколько SQL-запросов за один HTTP-запрос.
// Запросы от всех графиков с включённым автообновлением объединяются на клиенте
// и отправляются сюда одним пакетом, чтобы не нагружать сервер десятками
// одновременных запросов каждые 20 мс.
func HandleSQLQueryBatch(c *gin.Context) {

	var request struct {
		Queries []struct {
			ID  string `json:"id"`
			Sql string `json:"sql"`
		} `json:"queries"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	results := make(map[string]interface{}, len(request.Queries))

	for _, q := range request.Queries {
		trimmedQuery := strings.TrimSpace(q.Sql)

		// Битый запрос не должен ронять весь пакет — пишем ошибку по его ключу.
		if trimmedQuery == "" {
			results[q.ID] = gin.H{"error": "SQL query is required"}
			continue
		}
		if !strings.HasPrefix(strings.ToUpper(trimmedQuery), "SELECT") {
			results[q.ID] = gin.H{"error": "Only SELECT queries are allowed"}
			continue
		}

		var rows []map[string]interface{}
		if err := database.DB.Raw(trimmedQuery).Scan(&rows).Error; err != nil {
			results[q.ID] = gin.H{"error": "Failed to execute query: " + err.Error()}
			continue
		}

		results[q.ID] = gin.H{"data": rows, "count": len(rows)}
	}

	c.JSON(http.StatusOK, gin.H{"results": results})
}
