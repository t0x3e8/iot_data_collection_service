#include <WiFi.h>
#include <WiFiManager.h>
#include <Preferences.h>
#include <Wire.h>
#include "sensor_handler.h"
#include "data_sender.h"
#include "wifi_manager.h"

// ============================================================================
// USER CONFIGURATION VARIABLES - MODIFY THESE AS NEEDED
// ============================================================================

// Device identification
String deviceName = "Filament box sensor";
String serverURL = "http://your_dashboard_url.com";

// Reading frequency configuration
int readingFrequencyMinutes = 30; // minutes
int readingFrequency = readingFrequencyMinutes * 60000; // convert to milliseconds

// Hardware pin configuration
const int BUTTON_PIN = 0; // GPIO pin for the reset button
#define SDA_PIN 8  // ESP32 I2C SDA pin
#define SCL_PIN 9  // ESP32 I2C SCL pin

// Button reset configuration
const unsigned long RESET_DURATION = 15000; // 15 seconds in milliseconds

// ============================================================================
// GLOBAL VARIABLES - DO NOT MODIFY UNLESS NECESSARY
// ============================================================================

WiFiManager wifiManager;
Preferences preferences;

// Button state tracking
unsigned long buttonPressStartTime = 0;
bool buttonPressed = false;

// Timing variables
unsigned long lastSensorRead = 0;
unsigned long lastDataPost = 0;

// Sensor data storage
float currentTemperature = 0.0;
float currentHumidity = 0.0;
bool sensorDataValid = false;

// ============================================================================
// SETUP FUNCTION
// ============================================================================

void setup() {
  Serial.begin(115200);
  
  // Initialize button pin
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  
  // Initialize I2C with custom pins
  Wire.begin(SDA_PIN, SCL_PIN);
  
  // Initialize AHT10 sensor
  if (initAHT10()) {
    Serial.println("AHT10 initialized successfully!");
  } else {
    Serial.println("AHT10 initialization failed!");
  }
  
  // Initialize preferences for configuration storage
  preferences.begin("config", false);
  
  // Setup WiFiManager with custom parameters
  setupWiFiManager(wifiManager, preferences, deviceName, serverURL, readingFrequencyMinutes, readingFrequency);
  readingFrequency = readingFrequencyMinutes * 60000; // update after loading config
  
  // Set callback to save custom parameters
  wifiManager.setSaveConfigCallback([&]() {
    saveConfigCallback(wifiManager, preferences, deviceName, serverURL, readingFrequencyMinutes, readingFrequency);
  });
  
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
  printConfiguration(deviceName, serverURL, readingFrequencyMinutes, readingFrequency);
}

// ============================================================================
// MAIN LOOP
// ============================================================================

void loop() {
  handleButtonPress();
  handleSensorReading();
  
  delay(100); // Small delay to prevent excessive polling
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

void handleButtonPress() {
  // Check button state for WiFi reset functionality
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
}

void handleSensorReading() {
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
        postDataToServer(serverURL, deviceName, currentTemperature, currentHumidity);
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
}