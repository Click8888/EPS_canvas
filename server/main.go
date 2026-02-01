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
        Password: "antivzlom",
        DBName:   "test",
    }

    // Инициализация БД
    if err := database.InitDB(dbConfig); err != nil {
        log.Fatalf("Ошибка подключения к БД: %v", err)
    }
    defer database.CloseDB()

    // Настройка роутера
    r := gin.Default()

    // Настройка CORS - исправленная версия
    r.Use(cors.New(cors.Config{
        AllowOrigins:     []string{"http://localhost:3000", "http://visualgraph.ru", "http://www.visualgraph.ru"},
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
        
        // Эндпоинты для управления генерацией данных
        api.POST("/generation/start", routes.StartGenerationHandler)
        api.POST("/generation/stop", routes.StopGenerationHandler)
        api.GET("/generation/status", routes.GenerationStatusHandler)

        // Эндпоинты для управления генерацией данных
        api.POST("/deltable", routes.DeleteTable)
        api.POST("/addrow", routes.AddRow)
        api.POST("/delrow", routes.DeleteRow)
        api.POST("/updaterow", routes.UpdateRow)
        api.POST("/downldata", routes.DownloadData)
        api.POST("/sqlquery", routes.SqlQuery)
    }

    // Выведите все зарегистрированные маршруты
    fmt.Println("Registered routes:")
    for _, route := range r.Routes() {
        fmt.Printf("%-6s %s\n", route.Method, route.Path)
    }

    // Запуск сервера
    r.Run(":8080")
}