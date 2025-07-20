#include "sensor_handler.h"

bool initAHT10() {
  // Soft reset
  Wire.beginTransmission(AHT10_ADDRESS);
  Wire.write(AHT10_SOFT_RESET_CMD);
  Wire.endTransmission();
  delay(20);
  
  // Initialize
  Wire.beginTransmission(AHT10_ADDRESS);
  Wire.write(AHT10_INIT_CMD);
  Wire.write(0x08);
  Wire.write(0x00);
  Wire.endTransmission();
  
  delay(300);
  
  // Check if initialized
  Wire.requestFrom(AHT10_ADDRESS, 1);
  if (Wire.available()) {
    uint8_t status = Wire.read();
    return (status & 0x68) == 0x08;
  }
  
  return false;
}

bool readAHT10(float* temperature, float* humidity) {
  // Trigger measurement
  Wire.beginTransmission(AHT10_ADDRESS);
  Wire.write(AHT10_START_MEASURMENT_CMD);
  Wire.write(0x33);
  Wire.write(0x00);
  Wire.endTransmission();
  
  delay(80);
  
  // Read data
  Wire.requestFrom(AHT10_ADDRESS, 6);
  
  if (Wire.available() < 6) {
    return false;
  }
  
  uint8_t data[6];
  for (int i = 0; i < 6; i++) {
    data[i] = Wire.read();
  }
  
  // Check if measurement is complete
  if (data[0] & 0x80) {
    return false;
  }
  
  // Calculate humidity
  uint32_t rawHumidity = ((uint32_t)data[1] << 12) | ((uint32_t)data[2] << 4) | (data[3] >> 4);
  *humidity = ((float)rawHumidity * 100.0) / 1048576.0;
  
  // Calculate temperature
  uint32_t rawTemperature = (((uint32_t)data[3] & 0x0F) << 16) | ((uint32_t)data[4] << 8) | data[5];
  *temperature = (((float)rawTemperature * 200.0) / 1048576.0) - 50.0;
  
  return true;
}