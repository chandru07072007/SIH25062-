#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <DHT.h>

// ---------------- WIFI ----------------
const char *ssid = "07";
const char *password = "07070707";

// IMPORTANT: Replace with the LAN IP of the machine running FastAPI.
// Example: http://192.168.1.20:8000/api/iot/reading
const char *backendUrl = "http://10.43.82.210:8000/api/iot/reading";

// Optional: set land_id from MongoDB if you want soil chart linkage
const char *landId = "";
const char *deviceId = "esp32-node-01";

WebServer server(80);

// ---------------- PINS ----------------
#define SOIL_PIN 34
#define RAIN_PIN 35
#define DHT_PIN 4
#define MOTOR_PIN 18
#define VALVE_PIN 19
#define SOLENOID_PIN 21

// ---------------- SENSOR ----------------
#define DHT_TYPE DHT11
DHT dht(DHT_PIN, DHT_TYPE);

// ---------------- CALIBRATION ----------------
#define DRY_VALUE 3500
#define WET_VALUE 1500

#define MOISTURE_LOW 30
#define MOISTURE_HIGH 70

// Active LOW relay
#define RELAY_ON LOW
#define RELAY_OFF HIGH

// ---------------- VARIABLES ----------------
int moistureRaw = 0;
int moisturePercent = 0;
bool rainDetected = false;
float temperature = 0;
float humidity = 0;
bool motorState = false;
bool valveState = false;
bool manualOverride = false;

unsigned long lastUpdateTime = 0;

// ---------------- MOTOR CONTROL ----------------
void startMotor()
{
    digitalWrite(MOTOR_PIN, RELAY_ON);
    digitalWrite(VALVE_PIN, RELAY_ON);
    digitalWrite(SOLENOID_PIN, RELAY_ON);
    motorState = true;
    valveState = true;
}

void stopMotor()
{
    digitalWrite(MOTOR_PIN, RELAY_OFF);
    digitalWrite(VALVE_PIN, RELAY_OFF);
    digitalWrite(SOLENOID_PIN, RELAY_OFF);
    motorState = false;
    valveState = false;
}

void postToBackend()
{
    if (WiFi.status() != WL_CONNECTED)
    {
        Serial.println("WiFi disconnected: skipping backend sync");
        return;
    }

    HTTPClient http;
    WiFiClient client;
    http.begin(client, backendUrl);
    http.setTimeout(5000);
    http.addHeader("Content-Type", "application/json");

    String payload = "{";
    payload += "\"device_id\":\"" + String(deviceId) + "\",";
    if (strlen(landId) > 0)
    {
        payload += "\"land_id\":\"" + String(landId) + "\",";
    }
    payload += "\"ip\":\"" + WiFi.localIP().toString() + "\",";
    payload += "\"moisture\":" + String(moisturePercent) + ",";
    payload += "\"temperature\":" + String(temperature, 1) + ",";
    payload += "\"humidity\":" + String(humidity, 1) + ",";
    payload += "\"rain\":\"" + String(rainDetected ? "YES" : "NO") + "\",";
    payload += "\"motor\":\"" + String(motorState ? "ON" : "OFF") + "\",";
    payload += "\"valve\":\"" + String(valveState ? "OPEN" : "CLOSED") + "\"";
    payload += "}";

    int code = http.POST(payload);
    String response = http.getString();

    Serial.print("API POST code: ");
    Serial.println(code);
    Serial.print("Backend URL: ");
    Serial.println(backendUrl);
    if (code > 0 && code < 300)
    {
        Serial.println("ESP32 telemetry synced to backend successfully.");
    }
    else
    {
        Serial.println("Warning: backend sync failed. Check the FastAPI URL and LAN IP.");
        if (code <= 0)
        {
            Serial.print("HTTP error detail: ");
            Serial.println(http.errorToString(code));
        }
    }
    if (response.length() > 0)
    {
        Serial.print("API response: ");
        Serial.println(response);
    }

    http.end();
}

// ---------------- WEB DASHBOARD ----------------
void handleRoot()
{
    String html = "<!DOCTYPE html><html><head>";
    html += "<meta http-equiv='refresh' content='3'>";
    html += "<style>body{text-align:center;font-family:Arial;}</style>";
    html += "</head><body>";

    html += "<h2>Smart Irrigation System</h2>";
    html += "<p><b>IP:</b> " + WiFi.localIP().toString() + "</p>";
    html += "<p>Moisture: " + String(moisturePercent) + "%</p>";
    html += "<p>Temp: " + String(temperature) + " C</p>";
    html += "<p>Humidity: " + String(humidity) + " %</p>";
    html += "<p>Rain: " + String(rainDetected ? "YES" : "NO") + "</p>";
    html += "<p>Motor: " + String(motorState ? "ON" : "OFF") + "</p>";
    html += "<p>Valve: " + String(valveState ? "OPEN" : "CLOSED") + "</p>";

    html += "<a href='/on'><button>ON</button></a>";
    html += "<a href='/off'><button>OFF</button></a>";

    html += "</body></html>";

    server.send(200, "text/html", html);
}

// ---------------- JSON API ----------------
void handleData()
{
    String json = "{";
    json += "\"ip\":\"" + WiFi.localIP().toString() + "\",";
    json += "\"moisture\":" + String(moisturePercent) + ",";
    json += "\"temperature\":" + String(temperature) + ",";
    json += "\"humidity\":" + String(humidity) + ",";
    json += "\"rain\":\"" + String(rainDetected ? "YES" : "NO") + "\",";
    json += "\"motor\":\"" + String(motorState ? "ON" : "OFF") + "\",";
    json += "\"valve\":\"" + String(valveState ? "OPEN" : "CLOSED") + "\"";
    json += "}";

    server.send(200, "application/json", json);
}

// ---------------- MANUAL CONTROL ----------------
void handleOn()
{
    manualOverride = true;
    startMotor();
    server.sendHeader("Location", "/");
    server.send(303);
}

void handleOff()
{
    manualOverride = false;
    stopMotor();
    server.sendHeader("Location", "/");
    server.send(303);
}

// ---------------- SETUP ----------------
void setup()
{
    Serial.begin(115200);
    delay(2000);

    pinMode(MOTOR_PIN, OUTPUT);
    pinMode(VALVE_PIN, OUTPUT);
    pinMode(SOLENOID_PIN, OUTPUT);
    pinMode(RAIN_PIN, INPUT);

    stopMotor();
    dht.begin();

    WiFi.begin(ssid, password);
    Serial.print("Connecting WiFi");

    while (WiFi.status() != WL_CONNECTED)
    {
        delay(500);
        Serial.print(".");
    }

    Serial.println("\nWiFi Connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());

    server.on("/", handleRoot);
    server.on("/data", handleData);
    server.on("/on", handleOn);
    server.on("/off", handleOff);
    server.begin();
}

// ---------------- LOOP ----------------
void loop()
{
    server.handleClient();

    if (millis() - lastUpdateTime >= 3000)
    {
        lastUpdateTime = millis();

        // ---- Sensor Read ----
        moistureRaw = analogRead(SOIL_PIN);
        moisturePercent = map(moistureRaw, DRY_VALUE, WET_VALUE, 0, 100);
        moisturePercent = constrain(moisturePercent, 0, 100);

        rainDetected = (digitalRead(RAIN_PIN) == LOW);

        float t = dht.readTemperature();
        float h = dht.readHumidity();
        if (!isnan(t))
            temperature = t;
        if (!isnan(h))
            humidity = h;

        // ---- Control ----
        if (!manualOverride)
        {
            if (rainDetected)
            {
                stopMotor();
            }
            else if (moisturePercent <= MOISTURE_LOW && !motorState)
            {
                startMotor();
            }
            else if (moisturePercent >= MOISTURE_HIGH && motorState)
            {
                stopMotor();
            }
        }

        // ---- Push to backend ----
        postToBackend();

        // ---- SERIAL OUTPUT ----
        Serial.println("=================================");

        Serial.print("IP: ");
        Serial.println(WiFi.localIP());

        Serial.print("Moisture: ");
        Serial.print(moisturePercent);
        Serial.println("%");

        Serial.print("Temperature: ");
        Serial.print(temperature);
        Serial.println(" C");

        Serial.print("Humidity: ");
        Serial.print(humidity);
        Serial.println(" %");

        Serial.print("Rain: ");
        Serial.println(rainDetected ? "YES" : "NO");

        Serial.print("Motor: ");
        Serial.println(motorState ? "ON" : "OFF");

        Serial.print("Valve: ");
        Serial.println(valveState ? "OPEN" : "CLOSED");

        Serial.println("=================================");
    }
}
