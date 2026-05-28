package routes

import (
	"EPS/database"
	"net/http"

	"github.com/gin-gonic/gin"
)

type BatchQuery struct {
	Queries []BatchQueryItem `json:"queries"`
}

type BatchQueryItem struct {
	ID  string `json:"id"`
	SQL string `json:"sql"`
}

// HandleBatchQuery обрабатывает пакетные SQL запросы
func HandleBatchQuery(c *gin.Context) {
	var batchReq BatchQuery
	if err := c.ShouldBindJSON(&batchReq); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if len(batchReq.Queries) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No queries provided"})
		return
	}

	results := make(map[string]interface{})
	db := database.GetDB()

	if db == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database not connected"})
		return
	}

	// Выполняем каждый запрос
	for _, query := range batchReq.Queries {

		// Выполняем raw SQL запрос через GORM
		rows, err := db.Raw(query.SQL).Rows()
		if err != nil {
			results[query.ID] = gin.H{"error": err.Error()}
			continue
		}

		// Получаем колонки
		columns, err := rows.Columns()
		if err != nil {
			results[query.ID] = gin.H{"error": err.Error()}
			rows.Close()
			continue
		}

		// Сканируем результаты
		var data []map[string]interface{}
		for rows.Next() {
			values := make([]interface{}, len(columns))
			valuePtrs := make([]interface{}, len(columns))
			for i := range values {
				valuePtrs[i] = &values[i]
			}

			if err := rows.Scan(valuePtrs...); err != nil {
				continue
			}

			row := make(map[string]interface{})
			for i, col := range columns {
				val := values[i]
				if val == nil {
					row[col] = nil
					continue
				}

				// Конвертируем []byte в string для читаемости
				switch v := val.(type) {
				case []byte:
					row[col] = string(v)
				default:
					row[col] = v
				}
			}
			data = append(data, row)
		}
		rows.Close()

		results[query.ID] = data
	}

	c.JSON(http.StatusOK, gin.H{"results": results})
}
