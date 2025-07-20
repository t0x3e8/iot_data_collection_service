#include "wifi_manager.h"

void setupWiFiManager(WiFiManager& wifiManager, Preferences& preferences,
                     String& deviceName, String& serverURL, int& readingFrequencyMinutes, int& readingFrequency) {
  // Load saved configuration
  loadConfiguration(preferences, deviceName, serverURL, readingFrequencyMinutes, readingFrequency);
  
  // Create static WiFiManagerParameter objects to ensure they persist
  static WiFiManagerParameter custom_device_name("device_name", "Device Name", "", 40);
  static WiFiManagerParameter custom_server_url("server_url", "Dashboard URL", "", 100);
  static WiFiManagerParameter custom_reading_freq("reading_freq", "Reading Frequency (minutes)", "", 10);
  
  // Update parameter values
  custom_device_name.setValue(deviceName.c_str(), 40);
  custom_server_url.setValue(serverURL.c_str(), 100);
  custom_reading_freq.setValue(String(readingFrequencyMinutes).c_str(), 10);
  
  // Add parameters to WiFiManager
  wifiManager.addParameter(&custom_device_name);
  wifiManager.addParameter(&custom_server_url);
  wifiManager.addParameter(&custom_reading_freq);
  
  // Configure WiFiManager settings
  wifiManager.setSaveParamsCallback([]() {
    Serial.println("Parameters should be saved");
    return true;
  });
  
  // Set configuration portal timeout to 300 seconds (5 minutes)
  wifiManager.setConfigPortalTimeout(300);
}

void loadConfiguration(Preferences& preferences, String& deviceName, 
                      String& serverURL, int& readingFrequencyMinutes, int& readingFrequency) {
  deviceName = preferences.getString("device_name", "ESP32-Device");
  serverURL = preferences.getString("server_url", "http://localhost:3000");
  readingFrequencyMinutes = preferences.getInt("reading_freq", 5);
  readingFrequency = readingFrequencyMinutes * 60000; // convert to milliseconds
}

void saveConfigCallback(WiFiManager& wifiManager, Preferences& preferences,
                       String& deviceName, String& serverURL, int& readingFrequencyMinutes, int& readingFrequency) {
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

void printConfiguration(const String& deviceName, const String& serverURL, 
                       int readingFrequencyMinutes, int readingFrequency) {
  Serial.println("=== Current Configuration ===");
  Serial.println("Device Name: " + deviceName);
  Serial.println("Server URL: " + serverURL);
  Serial.println("Reading Frequency: " + String(readingFrequencyMinutes) + " minutes (" + String(readingFrequency) + " ms)");
  Serial.println("=============================");
}