package main

import (
    "EPS/database"
    "fmt"
    "log"
    "EPS/routes"
    "time"

    "github.com/gin-contrib/cors"
    "github.com/gin-gonic/gin"
)

func main() {
    dbConfig := database.Config{
        Host:     "localhost",
        Port:     5432,
        User:     "postgres",
        Password: "123",
        DBName:   "pmu",
    }

    // Инициализация БД
    if err := database.InitDB(dbConfig); err != nil {
        log.Fatalf("Ошибка подключения к БД: %v", err)
    }
    defer database.CloseDB()

    // Настройка роутера
    r := gin.Default()

    // Настройка CORS
    r.Use(cors.New(cors.Config{
        AllowOrigins:     []string{"*"},
        AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"},
        AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "Accept", "X-Requested-With"},
        ExposeHeaders:    []string{"Content-Length", "Access-Control-Allow-Origin", "Access-Control-Allow-Credentials"},
        AllowCredentials: true,
        MaxAge:           12 * time.Hour,
    }))

    // Middleware для логгирования
    r.Use(func(c *gin.Context) {
        fmt.Printf("Received %s request for: %s\n", c.Request.Method, c.Request.URL.Path)
        c.Next()
    })

    // Группа маршрутов с префиксом /api
    api := r.Group("/api")
    {
        api.GET("/getparams", routes.GetDatabases)
        api.GET("/metadata", routes.GetDatabaseMetadata)    
        api.POST("/execute-query", routes.HandleSQLQuery)

        // batch-запрос на данные
        api.POST("/batch-query", routes.HandleBatchQuery)
        
        //Эндпоинты админки
        api.POST("/deltable", routes.DeleteTable)
        api.POST("/addrow", routes.AddRow)
        api.POST("/delrow", routes.DeleteRow)
        api.POST("/updaterow", routes.UpdateRow)
        api.POST("/downldata", routes.DownloadData)
        api.POST("/sqlquery", routes.SqlQuery)

        //Подключение к БД
        api.POST("/connect", routes.ConnectDB)
        api.GET("/connection-status", routes.GetConnectionStatus)
    }

    // Выведите все зарегистрированные маршруты
    fmt.Println("Registered routes:")
    for _, route := range r.Routes() {
        fmt.Printf("%-6s %s\n", route.Method, route.Path)
    }

    // Запуск сервера
    r.Run(":8080")
}