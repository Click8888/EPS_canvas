package models

import "time"

type PMUMeasurement struct {
	ID           uint      `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	Time         time.Time `gorm:"column:time;not null" json:"time"`
	CurrentValue float64   `gorm:"column:current_value" json:"current_value"`
	VoltageValue float64   `gorm:"column:voltage_value" json:"voltage_value"`
}

func (PMUMeasurement) TableName() string {
	return "pmu_measurements"
}
