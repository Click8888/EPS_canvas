package models

type Current_measurements struct {
	ID               uint   `gorm:"primaryKey"`
	Measurement_time string `gorm:"not null"`
	Current_value    float32
	Voltage_value    float32
	Circuit_id       string
	Sensor_model     string
	Is_overload      bool
}
