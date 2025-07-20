#include <WiFi.h>
#include <WiFiManager.h>
#include <Preferences.h>
#include <Wire.h>
#include "esp_sleep.h"
#include "driver/gpio.h"
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
uint64_t deepSleepMicroseconds = readingFrequencyMinutes * 60 * 1000000; // convert to microseconds for deep sleep

// Hardware pin configuration
const int BUTTON_PIN = 2; // GPIO pin for the reset button
#define SDA_PIN 8  // ESP32 I2C SDA pin
#define SCL_PIN 9  // ESP32 I2C SCL pin

// Button reset configuration
const unsigned long RESET_DURATION = 15000; // 15 seconds in milliseconds
#define uS_TO_S_FACTOR 1000000ULL  // Conversion factor for micro seconds to seconds

// ============================================================================
// GLOBAL VARIABLES - DO NOT MODIFY UNLESS NECESSARY
// ============================================================================

WiFiManager wifiManager;
Preferences preferences;

// RTC memory variables (survive deep sleep)
RTC_DATA_ATTR int bootCount = 0;
RTC_DATA_ATTR bool configModeRequested = false;

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
// HELPER FUNCTIONS
// ============================================================================

void print_wakeup_reason() {
    esp_sleep_wakeup_cause_t wakeup_reason = esp_sleep_get_wakeup_cause();
    
    switch(wakeup_reason) {
        case ESP_SLEEP_WAKEUP_GPIO: {
            Serial.println("Wakeup caused by GPIO (button press)");
            uint64_t gpio_status = esp_sleep_get_gpio_wakeup_status();
            Serial.printf("GPIO that triggered the wakeup: GPIO%d\n", 
                         (int)(log(gpio_status)/log(2)));
            break;
        }
        case ESP_SLEEP_WAKEUP_TIMER:
            Serial.println("Wakeup caused by timer (scheduled reading)");
            break;
        default:
            Serial.printf("Wakeup was not caused by deep sleep: %d\n", wakeup_reason);
            Serial.println("This is a power-on reset or manual reset");
            break;
    }
}

bool checkButtonHold() {
    Serial.println("Button detected! Checking for 15-second hold...");
    Serial.println("Keep holding button for 15 seconds to enter config mode");
    
    unsigned long startTime = millis();
    int countdown = 15;
    
    while (millis() - startTime < RESET_DURATION) {
        if (digitalRead(BUTTON_PIN) == HIGH) {
            Serial.println("Button released too early. Continuing normal operation.");
            return false;
        }
        
        // Show countdown every second
        if ((millis() - startTime) >= (15 - countdown) * 1000) {
            Serial.printf("Hold for %d more seconds...\n", countdown);
            countdown--;
        }
        
        delay(100);
    }
    
    Serial.println("SUCCESS: 15-second hold detected!");
    return true;
}

void enterConfigMode() {
    Serial.println("=== ENTERING CONFIG MODE ===");
    
    // Initialize WiFiManager with custom parameters
    setupWiFiManager(wifiManager, preferences, deviceName, serverURL, readingFrequencyMinutes, readingFrequency);
    
    // Set callback to save custom parameters
    wifiManager.setSaveConfigCallback([&]() {
        saveConfigCallback(wifiManager, preferences, deviceName, serverURL, readingFrequencyMinutes, readingFrequency);
        deepSleepMicroseconds = readingFrequencyMinutes * 60 * 1000000ULL;
    });
    
    // Force WiFiManager to start configuration portal
    wifiManager.resetSettings(); // Clear saved WiFi credentials
    
    if (!wifiManager.autoConnect("ESP32-Config")) {
        Serial.println("Failed to connect and hit timeout in config mode");
        ESP.restart();
    }
    
    Serial.println("Config mode completed. Returning to normal operation.");
    configModeRequested = false;
}

// ============================================================================
// SETUP FUNCTION
// ============================================================================

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  ++bootCount;
  Serial.println("\n" + String(50, '='));
  Serial.printf("ESP32 IoT Device - Boot #%d\n", bootCount);
  Serial.println(String(50, '='));
  
  print_wakeup_reason();
  
  // Initialize button pin
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  
  esp_sleep_wakeup_cause_t wakeup_reason = esp_sleep_get_wakeup_cause();
  
  // Check if we woke up from button press
  if (wakeup_reason == ESP_SLEEP_WAKEUP_GPIO) {
      // Check if button is still pressed (for hold detection)
      if (digitalRead(BUTTON_PIN) == LOW) {
          if (checkButtonHold()) {
              configModeRequested = true;
          }
      } else {
          Serial.println("Button was pressed briefly. Continuing normal operation.");
      }
  }
  
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
  
  // Execute appropriate mode
  if (configModeRequested) {
      enterConfigMode();
  } else {
      // Normal operation mode - load config and connect to WiFi
      setupWiFiManager(wifiManager, preferences, deviceName, serverURL, readingFrequencyMinutes, readingFrequency);
      readingFrequency = readingFrequencyMinutes * 60000;
      deepSleepMicroseconds = readingFrequencyMinutes * 60 * 1000000ULL;
      
      // Try to connect to WiFi (don't start config portal on failure)
      WiFi.mode(WIFI_STA);
      wifiManager.setConfigPortalTimeout(30); // 30 second timeout
      
      if (!wifiManager.autoConnect()) {
          Serial.println("Failed to connect to WiFi - will retry next wake cycle");
          // Go back to sleep and try again later
          esp_sleep_enable_timer_wakeup(deepSleepMicroseconds);
          esp_deep_sleep_enable_gpio_wakeup(1ULL << BUTTON_PIN, ESP_GPIO_WAKEUP_GPIO_LOW);
          esp_deep_sleep_start();
      }
      
      Serial.println("WiFi connected successfully!");
      Serial.print("IP address: ");
      Serial.println(WiFi.localIP());
      
      // Print current configuration
      printConfiguration(deviceName, serverURL, readingFrequencyMinutes, readingFrequency);
  }
  
  // Take initial sensor reading and send data before going to sleep
  if (readAHT10(&currentTemperature, &currentHumidity)) {
    Serial.println("=== Initial Sensor Reading ===");
    Serial.print("Temperature: ");
    Serial.print(currentTemperature, 2);
    Serial.println(" °C");
    
    Serial.print("Humidity: ");
    Serial.print(currentHumidity, 2);
    Serial.println(" %");
    
    // Send data immediately
    if (WiFi.status() == WL_CONNECTED) {
      postDataToServer(serverURL, deviceName, currentTemperature, currentHumidity);
    } else {
      Serial.println("WiFi not connected, cannot post data");
    }
  } else {
    Serial.println("Failed to read from AHT10!");
  }
  
  // Prepare for next sleep cycle
  Serial.println("\n--- Preparing for Deep Sleep ---");
  
  // Configure wake sources
  esp_deep_sleep_enable_gpio_wakeup(1ULL << BUTTON_PIN, ESP_GPIO_WAKEUP_GPIO_LOW);
  esp_sleep_enable_timer_wakeup(deepSleepMicroseconds);
  
  Serial.printf("ESP32 will sleep for %d minutes\n", readingFrequencyMinutes);
  Serial.printf("Or wake immediately if GPIO %d button is pressed\n", BUTTON_PIN);
  Serial.println("Hold button for 15 seconds after wake to enter config mode");
  Serial.flush();
  
  // Enter deep sleep
  Serial.println("Going to sleep now...");
  esp_deep_sleep_start();
}

// ============================================================================
// MAIN LOOP
// ============================================================================

void loop() {
  // This loop should never be reached in deep sleep mode
  // If we reach here, something went wrong - restart
  Serial.println("ERROR: Loop reached - restarting to fix issue");
  ESP.restart();
}

