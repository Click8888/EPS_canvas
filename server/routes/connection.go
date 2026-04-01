package routes

import (
	"EPS/database"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

type ConnectRequest struct {
	Host     string `json:"host"   binding:"required"`
	Port     int    `json:"port"   binding:"required,min=1,max=65535"`
	User     string `json:"user"   binding:"required"`
	Password string `json:"password"`                       // может быть пустым
	DBName   string `json:"dbname" binding:"required"`
}

// ConnectDB — POST /api/connect
// Переподключается к БД с новыми параметрами
func ConnectDB(c *gin.Context) {
	fmt.Println("ConnectDB handler called")
	var req ConnectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Некорректные данные: " + err.Error(),
		})
		return
	}

	cfg := database.Config{
		Host:     req.Host,
		Port:     req.Port,
		User:     req.User,
		Password: req.Password,
		DBName:   req.DBName,
	}

	if err := database.Reconnect(cfg); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Успешно подключено",
		"config": gin.H{
			"host":   req.Host,
			"port":   req.Port,
			"user":   req.User,
			"dbname": req.DBName,
		},
	})
}

// GetConnectionStatus — GET /api/connection-status
// Возвращает текущий статус подключения
func GetConnectionStatus(c *gin.Context) {
	fmt.Println("GetConnectionStatus handler called")
	cfg := database.GetCurrentConfig()

	c.JSON(http.StatusOK, gin.H{
		"connected": database.IsConnected(),
		"config": gin.H{
			"host":   cfg.Host,
			"port":   cfg.Port,
			"user":   cfg.User,
			"dbname": cfg.DBName,
		},
	})
}
