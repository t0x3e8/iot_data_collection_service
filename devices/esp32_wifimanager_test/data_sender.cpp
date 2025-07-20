#include "data_sender.h"

void postDataToServer(const String& serverURL, const String& deviceName, 
                     float temperature, float humidity) {
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
  data["temperature"] = round(temperature * 100.0) / 100.0;
  data["humidity"] = round(humidity * 100.0) / 100.0;
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