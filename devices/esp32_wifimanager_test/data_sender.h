#ifndef DATA_SENDER_H
#define DATA_SENDER_H

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

void postDataToServer(const String& serverURL, const String& deviceName, 
                     float temperature, float humidity);

#endif