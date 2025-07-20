#include <WiFi.h>
#include <WiFiManager.h>
#include <Preferences.h>
#include <Wire.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const int BUTTON_PIN = 0; // GPIO pin for the reset button
const unsigned long RESET_DURATION = 15000; // 15 seconds in milliseconds

WiFiManager wifiManager;
Preferences preferences;
unsigned long buttonPressStartTime = 0;
bool buttonPressed = false;

// Configuration variables
String deviceName = "Filament box sensor";
String serverURL = "http://your_dashboard_url.com";
int readingFrequencyMinutes = 30; // minutes
int readingFrequency = readingFrequencyMinutes * 60000; // convert to milliseconds

// AHT10 I2C address
#define AHT10_ADDRESS 0x38

// AHT10 commands
#define AHT10_INIT_CMD 0xE1
#define AHT10_START_MEASURMENT_CMD 0xAC
#define AHT10_NORMAL_CMD 0xA8
#define AHT10_SOFT_RESET_CMD 0xBA

// ESP32 I2C pins (adjust for your board)
#define SDA_PIN 8
#define SCL_PIN 9

// Timing
unsigned long lastSensorRead = 0;
unsigned long lastDataPost = 0;

// Data storage
float currentTemperature = 0.0;
float currentHumidity = 0.0;
bool sensorDataValid = false;

void setup() {
  Serial.begin(115200);
  
  // Initialize button pin
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  
  // Initialize I2C with custom pins
  Wire.begin(SDA_PIN, SCL_PIN);
  
  // Initialize AHT10
  if (initAHT10()) {
    Serial.println("AHT10 initialized successfully!");
  } else {
    Serial.println("AHT10 initialization failed!");
  }
  
  // Initialize preferences
  preferences.begin("config", false);
  
  // Load saved configuration
  loadConfiguration();
  
  // Setup custom parameters for WiFiManager
  WiFiManagerParameter custom_device_name("device_name", "Device Name", deviceName.c_str(), 40);
  WiFiManagerParameter custom_server_url("server_url", "Dashboard Url", serverURL.c_str(), 100);
  WiFiManagerParameter custom_reading_freq("reading_freq", "Reading Frequency (minutes)", String(readingFrequencyMinutes).c_str(), 10);
  
  // Add parameters to WiFiManager
  wifiManager.addParameter(&custom_device_name);
  wifiManager.addParameter(&custom_server_url);
  wifiManager.addParameter(&custom_reading_freq);
  
  // Set callback to save custom parameters
  wifiManager.setSaveConfigCallback(saveConfigCallback);
  
  // WiFiManager auto connect
  // It will try to connect to the last known network
  // If it fails, it will create an AP with the name "ESP32-Config"
  if (!wifiManager.autoConnect("ESP32-Config")) {
    Serial.println("Failed to connect and hit timeout");
    // Reset and try again
    ESP.restart();
    delay(1000);
  }
  
  Serial.println("WiFi connected successfully!");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
  
  // Print current configuration
  printConfiguration();
}

void loop() {
  // Check button state
  if (digitalRead(BUTTON_PIN) == LOW) { // Button pressed (assuming active LOW)
    if (!buttonPressed) {
      buttonPressed = true;
      buttonPressStartTime = millis();
      Serial.println("Button pressed - hold for 15 seconds to reset WiFi settings");
    } else {
      // Check if button has been held for 15 seconds
      if (millis() - buttonPressStartTime >= RESET_DURATION) {
        Serial.println("Resetting WiFi settings...");
        
        // Clear saved WiFi credentials and custom configuration
        wifiManager.resetSettings();
        preferences.clear();
        
        Serial.println("WiFi settings and configuration cleared. Restarting...");
        delay(1000);
        ESP.restart();
      }
    }
  } else {
    // Button released
    if (buttonPressed) {
      buttonPressed = false;
      Serial.println("Button released");
    }
  }
  
  // Main application code
  unsigned long currentTime = millis();
  
  // Read sensor data based on configured frequency
  if (currentTime - lastSensorRead >= readingFrequency) {
    if (readAHT10(&currentTemperature, &currentHumidity)) {
      Serial.println("=== Sensor Reading ===");
      Serial.print("Temperature: ");
      Serial.print(currentTemperature, 2);
      Serial.println(" °C");
      
      Serial.print("Humidity: ");
      Serial.print(currentHumidity, 2);
      Serial.println(" %");
      
      sensorDataValid = true;
      
      // Send data immediately after reading sensor
      if (WiFi.status() == WL_CONNECTED) {
        postDataToServer();
        lastDataPost = currentTime;
      } else {
        Serial.println("WiFi not connected, cannot post data");
      }
    } else {
      Serial.println("Failed to read from AHT10!");
      sensorDataValid = false;
    }
    
    lastSensorRead = currentTime;
  }
  
  delay(100); // Small delay to prevent excessive polling
}

void loadConfiguration() {
  deviceName = preferences.getString("device_name", "ESP32-Device");
  serverURL = preferences.getString("server_url", "http://localhost:3000");
  readingFrequencyMinutes = preferences.getInt("reading_freq", 5);
  readingFrequency = readingFrequencyMinutes * 60000; // convert to milliseconds
}

void saveConfigCallback() {
  Serial.println("Configuration should be saved");
  
  // Get parameters from WiFiManager
  deviceName = wifiManager.server->arg("device_name");
  serverURL = wifiManager.server->arg("server_url");
  readingFrequencyMinutes = wifiManager.server->arg("reading_freq").toInt();
  readingFrequency = readingFrequencyMinutes * 60000; // convert to milliseconds
  
  // Save to preferences
  preferences.putString("device_name", deviceName);
  preferences.putString("server_url", serverURL);
  preferences.putInt("reading_freq", readingFrequencyMinutes);
  
  Serial.println("Configuration saved!");
}

void printConfiguration() {
  Serial.println("=== Current Configuration ===");
  Serial.println("Device Name: " + deviceName);
  Serial.println("Server URL: " + serverURL);
  Serial.println("Reading Frequency: " + String(readingFrequencyMinutes) + " minutes (" + String(readingFrequency) + " ms)");
  Serial.println("=============================");
}

void postDataToServer() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected, cannot post data");
    return;
  }
  
  HTTPClient http;
  http.begin(serverURL + "/api/data");
  http.addHeader("Content-Type", "application/json");
  
  // Create JSON payload
  DynamicJsonDocument doc(1024);
  doc["device_id"] = deviceName + "_" + WiFi.macAddress();
  doc["device_name"] = deviceName;
  
  // Create data object with sensor readings
  JsonObject data = doc.createNestedObject("data");
  data["temperature"] = round(currentTemperature * 100.0) / 100.0;
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