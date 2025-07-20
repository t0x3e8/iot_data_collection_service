#ifndef SENSOR_HANDLER_H
#define SENSOR_HANDLER_H

#include <Wire.h>

// AHT10 I2C address
#define AHT10_ADDRESS 0x38

// AHT10 commands
#define AHT10_INIT_CMD 0xE1
#define AHT10_START_MEASURMENT_CMD 0xAC
#define AHT10_NORMAL_CMD 0xA8
#define AHT10_SOFT_RESET_CMD 0xBA

bool initAHT10();
bool readAHT10(float* temperature, float* humidity);

#endif