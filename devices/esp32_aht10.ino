#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// WiFi credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// API server configuration
const char* serverURL = "http://YOUR_SERVER_IP:3000/api/data";
const String deviceID = "ESP32_AHT10_001";  // Unique device identifier
const String deviceName = "Living Room Sensor";  // Human readable name

// AHT10 I2C address
#define AHT10_ADDRESS 0x38

// AHT10 commands
#define AHT10_INIT_CMD 0xE1
#define AHT10_START_MEASURMENT_CMD 0xAC
#define AHT10_NORMAL_CMD 0xA8
#define AHT10_SOFT_RESET_CMD 0xBA

// ESP32-C3 I2C pins
#define SDA_PIN 8
#define SCL_PIN 9

// Timing
unsigned long lastSensorRead = 0;
unsigned long lastDataPost = 0;
const unsigned long SENSOR_INTERVAL = 5000;  // Read sensor every 5 seconds
const unsigned long POST_INTERVAL = 30000;   // Post data every 30 seconds

// Data storage
float currentTemperature = 0.0;
float currentHumidity = 0.0;
bool sensorDataValid = false;

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("ESP32-C3 IoT Sensor Starting...");
  
  // Initialize I2C with custom pins
  Wire.begin(SDA_PIN, SCL_PIN);
  
  // Initialize AHT10
  if (initAHT10()) {
    Serial.println("AHT10 initialized successfully!");
  } else {
    Serial.println("AHT10 initialization failed!");
    return;
  }
  
  // Connect to WiFi
  connectToWiFi();
  
  Serial.println("Setup complete. Starting data collection...");
}

void loop() {
  unsigned long currentTime = millis();
  
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected, reconnecting...");
    connectToWiFi();
  }
  
  // Read sensor data every 5 seconds
  if (currentTime - lastSensorRead >= SENSOR_INTERVAL) {
    if (readAHT10(&currentTemperature, &currentHumidity)) {
      Serial.println("=== Sensor Reading ===");
      Serial.print("Temperature: ");
      Serial.print(currentTemperature, 2);
      Serial.println(" °C");
      
      Serial.print("Humidity: ");
      Serial.print(currentHumidity, 2);
      Serial.println(" %");
      
      sensorDataValid = true;
    } else {
      Serial.println("Failed to read from AHT10!");
      sensorDataValid = false;
    }
    
    lastSensorRead = currentTime;
  }
  
  // Post data to server every 30 seconds
  if (currentTime - lastDataPost >= POST_INTERVAL && sensorDataValid) {
    postDataToServer();
    lastDataPost = currentTime;
  }
  
  delay(100); // Small delay to prevent watchdog issues
}

void connectToWiFi() {
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("WiFi connected successfully!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
    Serial.print("Signal strength (RSSI): ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
  } else {
    Serial.println();
    Serial.println("Failed to connect to WiFi!");
  }
}

void postDataToServer() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected, cannot post data");
    return;
  }
  
  HTTPClient http;
  http.begin(serverURL);
  http.addHeader("Content-Type", "application/json");
  
  // Create JSON payload
  DynamicJsonDocument doc(1024);
  doc["device_id"] = deviceID;
  doc["device_name"] = deviceName;
  
  // Create data object with sensor readings
  JsonObject data = doc.createNestedObject("data");
  data["temperature"] = round(currentTemperature * 100.0) / 100.0; // Round to 2 decimal places
  data["humidity"] = round(currentHumidity * 100.0) / 100.0;
  data["rssi"] = WiFi.RSSI();
  data["free_heap"] = ESP.getFreeHeap();
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  Serial.println("=== Posting Data to Server ===");
  Serial.println("Payload: " + jsonString);
  
  int httpResponseCode = http.POST(jsonString);
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.print("HTTP Response Code: ");
    Serial.println(httpResponseCode);
    Serial.print("Response: ");
    Serial.println(response);
    
    if (httpResponseCode == 201) {
      Serial.println("✓ Data posted successfully!");
    } else {
      Serial.println("⚠ Server returned unexpected response code");
    }
  } else {
    Serial.print("✗ Error posting data. HTTP Error: ");
    Serial.println(httpResponseCode);
    Serial.println("Error: " + http.errorToString(httpResponseCode));
  }
  
  http.end();
}

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
  
  delay(300); // Wait for initialization
  
  // Check if initialized
  Wire.requestFrom(AHT10_ADDRESS, 1);
  if (Wire.available()) {
    uint8_t status = Wire.read();
    return (status & 0x68) == 0x08; // Check calibration bit
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
  
  delay(80); // Wait for measurement
  
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
    return false; // Measurement not complete
  }
  
  // Calculate humidity
  uint32_t rawHumidity = ((uint32_t)data[1] << 12) | ((uint32_t)data[2] << 4) | (data[3] >> 4);
  *humidity = ((float)rawHumidity * 100.0) / 1048576.0;
  
  // Calculate temperature
  uint32_t rawTemperature = (((uint32_t)data[3] & 0x0F) << 16) | ((uint32_t)data[4] << 8) | data[5];
  *temperature = (((float)rawTemperature * 200.0) / 1048576.0) - 50.0;
  
  return true;
}