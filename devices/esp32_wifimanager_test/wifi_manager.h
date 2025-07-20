#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include <WiFi.h>
#include <WiFiManager.h>
#include <Preferences.h>

void setupWiFiManager(WiFiManager& wifiManager, Preferences& preferences,
                     String& deviceName, String& serverURL, int& readingFrequencyMinutes, int& readingFrequency);
void loadConfiguration(Preferences& preferences, String& deviceName, 
                      String& serverURL, int& readingFrequencyMinutes, int& readingFrequency);
void saveConfigCallback(WiFiManager& wifiManager, Preferences& preferences,
                       String& deviceName, String& serverURL, int& readingFrequencyMinutes, int& readingFrequency);
void printConfiguration(const String& deviceName, const String& serverURL, 
                       int readingFrequencyMinutes, int readingFrequency);

#endif