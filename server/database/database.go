package database

import (
	"fmt"
	"sync"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type Config struct {
	Host     string
	Port     int
	User     string
	Password string
	DBName   string
}

var (
	DB            *gorm.DB
	currentConfig Config
	mu            sync.RWMutex
)

func InitDB(cfg Config) error {
	mu.Lock()
	defer mu.Unlock()
	return initDB(cfg)
}

// внутренняя функция без блокировки (вызывается из уже залоченных методов)
func initDB(cfg Config) error {
	dsn := fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=disable TimeZone=UTC",
		cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.DBName,
	)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		return fmt.Errorf("не удалось открыть соединение: %w", err)
	}

	// проверяем реальную связь с сервером
	sqlDB, err := db.DB()
	if err != nil {
		return fmt.Errorf("не удалось получить sql.DB: %w", err)
	}
	if err = sqlDB.Ping(); err != nil {
		return fmt.Errorf("сервер недоступен: %w", err)
	}

	currentConfig = cfg
	DB = db
	return nil
}

// Reconnect — закрывает старое подключение и открывает новое.
func Reconnect(cfg Config) error {
	mu.Lock()
	defer mu.Unlock()

	if DB != nil {
		if sqlDB, err := DB.DB(); err == nil {
			_ = sqlDB.Close()
		}
		DB = nil
	}

	return initDB(cfg)
}

func CloseDB() {
	mu.Lock()
	defer mu.Unlock()

	if DB != nil {
		if sqlDB, err := DB.DB(); err == nil {
			_ = sqlDB.Close()
		}
	}
}

func GetCurrentConfig() Config {
	mu.RLock()
	defer mu.RUnlock()
	return currentConfig
}

func IsConnected() bool {
	mu.RLock()
	defer mu.RUnlock()

	if DB == nil {
		return false
	}
	sqlDB, err := DB.DB()
	if err != nil {
		return false
	}
	return sqlDB.Ping() == nil
}
