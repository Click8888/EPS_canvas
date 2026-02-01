package routes

import (
	"net/http"
	"EPS/database"
	"fmt"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type TableInfo struct {
	TableName string       `json:"table_name"`
	Columns   []ColumnInfo `json:"columns"`
}

type ColumnInfo struct {
	ColumnName string `json:"column_name"`
	DataType   string `json:"data_type"`
	IsNullable string `json:"is_nullable"`
}

type DatabaseMetadata struct {
	Tables []TableInfo `json:"tables"`
}

// GetDatabaseMetadata возвращает метаданные всех таблиц и столбцов
func GetDatabaseMetadata(c *gin.Context) {
	metadata, err := getDatabaseMetadata(database.DB)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch database metadata: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"metadata": metadata})
}

// GetTableMetadata возвращает метаданные конкретной таблицы
func GetTableMetadata(c *gin.Context) {
	tableName := c.Param("tableName")

	if tableName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Table name is required"})
		return
	}

	columns, err := getTableColumns(database.DB, tableName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch table metadata: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"table_name": tableName,
		"columns":    columns,
	})
}

// GetTablesList возвращает список всех таблиц
func GetTablesList(c *gin.Context) {
	tables, err := getTables(database.DB)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch tables list: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"tables": tables})
}

// Вспомогательные функции

func getDatabaseMetadata(db *gorm.DB) (*DatabaseMetadata, error) {
	tables, err := getTables(db)
	if err != nil {
		return nil, err
	}

	var tableInfos []TableInfo
	for _, table := range tables {
		columns, err := getTableColumns(db, table)
		if err != nil {
			return nil, err
		}

		tableInfos = append(tableInfos, TableInfo{
			TableName: table,
			Columns:   columns,
		})
	}

	return &DatabaseMetadata{Tables: tableInfos}, nil
}

func getTables(db *gorm.DB) ([]string, error) {
	var tables []string

	// Запрос для получения списка таблиц в public схеме
	result := db.Raw(`
		SELECT table_name 
		FROM information_schema.tables 
		WHERE table_schema = 'public' 
		AND table_type = 'BASE TABLE'
		ORDER BY table_name
	`).Scan(&tables)

	if result.Error != nil {
		return nil, fmt.Errorf("failed to get tables: %w", result.Error)
	}

	return tables, nil
}

func getTableColumns(db *gorm.DB, tableName string) ([]ColumnInfo, error) {
	var columns []ColumnInfo

	// Запрос для получения информации о колонках таблицы
	result := db.Raw(`
		SELECT 
			column_name, 
			data_type, 
			is_nullable
		FROM information_schema.columns
		WHERE table_schema = 'public' 
		AND table_name = ?
		ORDER BY ordinal_position
	`, tableName).Scan(&columns)

	if result.Error != nil {
		return nil, fmt.Errorf("failed to get columns for table")
	}

	return columns, nil
}