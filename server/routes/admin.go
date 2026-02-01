package routes

import (
	"EPS/database"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// ------------- Удаление таблицы
func DeleteTable(c *gin.Context) {
	var request struct {
		Query string `json:"Sql"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Проверяем безопасность
	if !isSafeQuerySQL(request.Query) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Query contains potentially dangerous operations"})
		return
	}

	// Выполняем SQL запрос
	result := database.DB.Exec(request.Query)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to execute query: " + result.Error.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":       "Таблица данных удалена",
		"rows_affected": result.RowsAffected,
	})
}

// ----- Добавление новой строки
func AddRow(c *gin.Context) {
	var request struct {
		Query string `json:"Sql"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Проверяем безопасность
	if !isSafeQuerySQL(request.Query) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Query contains potentially dangerous operations"})
		return
	}

	// Выполняем SQL запрос
	result := database.DB.Exec(request.Query)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to execute query: " + result.Error.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":       "Строка добавлена",
		"rows_affected": result.RowsAffected,
	})
}

// ------Удаление строки
func DeleteRow(c *gin.Context) {
	var request struct {
		Query string `json:"Sql"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Проверяем безопасность
	if !isSafeQuerySQL(request.Query) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Query contains potentially dangerous operations"})
		return
	}

	// Выполняем SQL запрос
	result := database.DB.Exec(request.Query)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to execute query: " + result.Error.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":       "Строка удалена",
		"rows_affected": result.RowsAffected,
	})
}

// ------Обновление строки
func UpdateRow(c *gin.Context) {
	var request struct {
		Query string `json:"Sql"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Проверяем безопасность
	if !isSafeQuerySQL(request.Query) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Query contains potentially dangerous operations"})
		return
	}

	// Выполняем SQL запрос
	result := database.DB.Exec(request.Query)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to execute query: " + result.Error.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":       "Строка обновлена",
		"rows_affected": result.RowsAffected,
	})
}

// -------Универсальная загрузка данных
func DownloadData(c *gin.Context) {
	var request struct {
		Query string `json:"Sql"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if request.Query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "SQL query is required"})
		return
	}

	if !isSafeQuery(request.Query) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Query contains potentially dangerous operations"})
		return
	}

	var results []map[string]interface{}
	err := database.DB.Raw(request.Query).Scan(&results).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to execute query: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":   results,
		"count":  len(results),
		"status": "success",
	})
}

// --------Универсальное выполнение произвольного SQL запроса
func SqlQuery(c *gin.Context) {
	var request struct {
		Query string `json:"Sql"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if request.Query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "SQL query is required"})
		return
	}

	if !isSafeQuerySQL(request.Query) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Query contains potentially dangerous operations"})
		return
	}

	upperQuery := strings.ToUpper(strings.TrimSpace(request.Query))

	fmt.Println("upperQuery:", upperQuery)
	if strings.HasPrefix(upperQuery, "SELECT") {
		// Используем Rows() для ручного чтения результатов
		fmt.Println("upperQuery:", upperQuery)
		rows, err := database.DB.Raw(request.Query).Rows()
		fmt.Println("rows:", rows)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to execute query: " + err.Error()})
			return
		}
		defer rows.Close()

		// Получаем названия колонок
		columns, err := rows.Columns()
		fmt.Println("columns:", columns)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get columns: " + err.Error()})
			return
		}

		var results []map[string]interface{}

		fmt.Println("results: ", results)
		for rows.Next() {
			// Создаем срез для значений
			values := make([]interface{}, len(columns))
			valuePtrs := make([]interface{}, len(columns))
			for i := range values {
				valuePtrs[i] = &values[i]
			}

			// Сканируем строку
			if err := rows.Scan(valuePtrs...); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to scan row: " + err.Error()})
				return
			}

			// Создаем map для текущей строки
			rowMap := make(map[string]interface{})
			for i, col := range columns {
				val := values[i]
				if b, ok := val.([]byte); ok {
					rowMap[col] = string(b) // преобразуем []byte в string
				} else {
					rowMap[col] = val
				}
			}
			results = append(results, rowMap)
		}

		fmt.Println("results2: ", results)

		if err := rows.Err(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error iterating rows: " + err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"data":   results,
			"count":  len(results),
			"type":   "select",
			"status": "success",
		})

		fmt.Println("resultsDO: ", results)
	} else {
		result := database.DB.Exec(request.Query)
		if result.Error != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to execute query: " + result.Error.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"rows_affected": result.RowsAffected,
			"type":          "exec",
			"status":        "success",
		})
		
	}
	fmt.Println("?????????????????????????: ")
}

// Проверка безопасности для SELECT запросов
func isSafeQuery(query string) bool {
	query = strings.TrimSpace(strings.ToUpper(query))

	if !strings.HasPrefix(query, "SELECT") {
		return false
	}

	dangerousPatterns := []string{
		"DROP", "DELETE", "UPDATE", "INSERT", "ALTER",
		"TRUNCATE", "CREATE", "EXEC", "EXECUTE",
		"GRANT", "REVOKE", "--", "/*", "*/",
		"INFORMATION_SCHEMA", "PG_", "SYS.",
		"UNION", "HAVING", "GROUP BY",
	}

	for _, pattern := range dangerousPatterns {
		if strings.Contains(query, pattern) {
			return false
		}
	}

	return true
}

// Проверка безопасности для всех запросов (SELECT, INSERT, UPDATE, DELETE)
func isSafeQuerySQL(query string) bool {
	query = strings.TrimSpace(strings.ToUpper(query))

	if query == "" {
		return false
	}

	allowedPrefixes := []string{"SELECT", "INSERT", "UPDATE", "DELETE"}
	hasAllowedPrefix := false
	for _, prefix := range allowedPrefixes {
		if strings.HasPrefix(query, prefix) {
			hasAllowedPrefix = true
			break
		}
	}

	if !hasAllowedPrefix {
		return false
	}

	dangerousPatterns := []string{
		"DROP", "ALTER", "TRUNCATE", "CREATE", "EXEC", "EXECUTE",
		"GRANT", "REVOKE", "--", "/*", "*/", "INFORMATION_SCHEMA",
		"PG_", "SYS.", "SYSTEM.", "MASTER.", "MSDB.", "TEMPDB.",
		"XP_", "SP_", "FN_", "SHUTDOWN", "KILL", "BACKUP", "RESTORE",
	}

	for _, pattern := range dangerousPatterns {
		if strings.Contains(query, pattern) {
			return false
		}
	}

	return true
}
