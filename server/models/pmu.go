package models

import "time"

type PMUMeasurement struct {
    Time         time.Time `gorm:"column:time;primaryKey" json:"time"`
    CurrentValue float64   `gorm:"column:current_value" json:"current_value"`
    VoltageValue float64   `gorm:"column:voltage_value" json:"voltage_value"`
}

func (PMUMeasurement) TableName() string {
    return "pmu_measurements"
}