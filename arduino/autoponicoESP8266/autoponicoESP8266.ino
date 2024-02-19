// Arduino included libraries
#include <ESP8266WiFi.h>
#include <ESP8266httpUpdate.h>

// Download from https://files.atlas-scientific.com/gravity-pH-ardunio-code.pdf
#include <ph_iso_grav.h>

// Install from library manager
#include <ArduinoWebsockets.h>
// #include <DallasTemperature.h>
#include <InfluxDbClient.h>
#include <InfluxDbCloud.h>
// #include <OneWire.h>
#include <SimpleKalmanFilter.h>
#include <ArduinoJson.h>

// Custom libraries
#include <AtlasSerialSensor.h>
#include <Control.h>
#include <WebsocketCommands.h>

#include "configuration.h"
#include "env.h"

void (*resetFunc)(void) = 0;  // create a standard reset function

// InfluxDB
bool INFLUXDB_ENABLED = false;
#ifdef _INFLUXDB_URL
String INFLUXDB_URL = _INFLUXDB_URL;
String INFLUXDB_ORG = _INFLUXDB_ORG;
String INFLUXDB_BUCKET = _INFLUXDB_BUCKET;
String INFLUXDB_TOKEN = _INFLUXDB_TOKEN;
#else
String INFLUXDB_URL = "";
String INFLUXDB_ORG = "";
String INFLUXDB_BUCKET = "";
String INFLUXDB_TOKEN = "";
#endif

InfluxDBClient* influxClient;
Point autoponicoPoint("cultivo");

// Websockets
WebsocketCommands websocketCommands;

// Control
ControlConfig phConfiguration = {
    D1,           // M_UP_PIN
    D2,           // M_DN_PIN
    200,          // M_UP_SPEED,
    200,          // M_DN_SPEED,
};
ControlConfig ecUpConfiguration = {
    D8,           // M_UP_PIN
    0,            // M_DN_PIN,
    200,          // M_UP_SPEED,
    200,          // M_DN_SPEED,
};

Control phControl = Control(&phConfiguration);
Control ecUpControl = Control(&ecUpConfiguration);

// Ph sensor
Gravity_pH phSensor = Gravity_pH(D5);
SimpleKalmanFilter simpleKalmanPh(2, 2, 0.01);

// EC Sensor
AtlasSerialSensor ecSensor = AtlasSerialSensor(D7, D6);
SimpleKalmanFilter simpleKalmanEc(2, 2, 0.01);

// Timers
unsigned long sensorReadingTimer;
unsigned long influxSyncTimer;


void update_started() {
    String msg = "CALLBACK:  HTTP update process started";
    Serial.println(msg.c_str());
    websocketCommands.send((char*)msg.c_str());
}

void update_finished() {
    String msg = "CALLBACK:  HTTP update process finished";
    Serial.println(msg.c_str());
    websocketCommands.send((char*)msg.c_str());
}

void update_progress(int cur, int total) {
    String msg = "CALLBACK:  HTTP update process at ";
    msg += cur;
    msg += " of ";
    msg += total;
    msg += " bytes...";
    Serial.println(msg.c_str());
    websocketCommands.send((char*)msg.c_str());
}

void update_error(int err) {
    String msg = "CALLBACK:  HTTP update fatal error code ";
    msg += err;
    Serial.println(msg.c_str());
    websocketCommands.send((char*)msg.c_str());
}

void setupCommands() {
    websocketCommands.init(WEBSOCKET_URL);

    pinMode(LED_BUILTIN, OUTPUT);
    websocketCommands.registerCmd((char*)"ping", [](const char* action, const char* value) {
        if (strcmp(action, "on") == 0) {
            digitalWrite(LED_BUILTIN, LOW);
        } else if (strcmp(action, "off") == 0) {
            digitalWrite(LED_BUILTIN, HIGH);
        }
        Serial.print("Sending pong...");
        websocketCommands.send((char*)"pong");
        Serial.println("sent");
    });

    // Manage Analog Gravity pH
    websocketCommands.registerCmd((char*)"ph", [](const char* _action, const char* _value) {
        String action = String(_action);
        if (action == "cal_low") {
            phSensor.cal_low();
        } else if (action == "cal_mid") {
            phSensor.cal_mid();
        } else if (action == "cal_high") {
            phSensor.cal_high();
        } else if (action == "cal_clear") {
            phSensor.cal_clear();
        } else if (action == "read_ph") {
            websocketCommands.send((char*)String(phSensor.read_ph()).c_str());
        } else {
            Serial.printf("[Atlas Gravity] Unknown action type: %s\n", action);
            websocketCommands.send((char*)"[Atlas Gravity] Unknown action type");
        }
    });

    // Bypass websocket message to atlas' EZO UART eg "ec Cal,n"
    websocketCommands.registerCmd((char*)"ec", [](const char* _action, const char* _value) {
        String action = String(_action);
        String value = String(_value);
        ecSensor.sendSerial(action + " " + value);
    });

    // Control
    websocketCommands.registerCmd((char*)"control", [](const char* _action, const char* _value) {
        String action = String(_action);
        String value = String(_value);
        if (action == "ph_up") {
            phControl.up(value.toInt());
        } else if (action == "ph_down") {
            phControl.down(value.toInt());
        } else if (action == "ph_setpoint") {
            phControl.setpoint = value.toFloat();
        } else if (action == "ph_auto") {
            phControl.autoMode = value.toInt();
        } else if (action == "ec_up") {
            ecUpControl.up(value.toInt());
        } else if (action == "ec_down") {
            ecUpControl.down(value.toInt());
        } else if (action == "ec_setpoint") {
            ecUpControl.setpoint = value.toFloat();
        } else if (action == "ec_auto") {
            ecUpControl.autoMode = value.toInt();
        } else if (action == "info") {
            String response = String();
            JsonDocument doc;
            doc["ph_setpoint"] = phControl.setpoint;
            doc["ph_auto"] = phControl.autoMode;
            doc["ec_setpoint"] = ecUpControl.setpoint;
            doc["ec_auto"] = ecUpControl.autoMode;
            serializeJson(doc, response);
            websocketCommands.send((char*)response.c_str());
        } else {
            Serial.printf("[Control] Unknown action type: %s\n", action);
            websocketCommands.send((char*)"[Control] Unknown action type");
        }
    });

    // Kalman filters
    websocketCommands.registerCmd((char*)"kalman", [](const char* _action, const char* _value) {
        String action = String(_action);
        String value = String(_value);
        if (action == "ph_mea_error") {
            simpleKalmanPh.setMeasurementError(value.toFloat());
        } else if (action == "ph_est_error") {
            simpleKalmanPh.setEstimateError(value.toFloat());
        } else if (action == "ph_proc_noise") {
            simpleKalmanPh.setProcessNoise(value.toFloat());
        } else if (action == "ec_mea_error") {
            simpleKalmanEc.setMeasurementError(value.toFloat());
        } else if (action == "ec_est_error") {
            simpleKalmanEc.setEstimateError(value.toFloat());
        } else if (action == "ec_proc_noise") {
            simpleKalmanEc.setProcessNoise(value.toFloat());
        } else {
            Serial.printf("[Kalman] Unknown action type: %s\n", action);
            websocketCommands.send((char*)"[Kalman] Unknown action type");
        }
    });

    // InfluxDB
    websocketCommands.registerCmd((char*)"influxdb", [](const char* _action, const char* _value) {
        String action = String(_action);
        String value = String(_value);
        if (action == "info") {
            String response = String();
            JsonDocument doc;
            doc["enabled"] = INFLUXDB_ENABLED;
            doc["url"] = INFLUXDB_URL;
            doc["org"] = INFLUXDB_ORG;
            doc["bucket"] = INFLUXDB_BUCKET;
            doc["token"] = INFLUXDB_TOKEN;
            serializeJson(doc, response);
            websocketCommands.send((char*)response.c_str());
            return;
        } else if (action == "enabled") {
            INFLUXDB_ENABLED = value.toInt();
        } else if (action == "update") {
            JsonDocument doc;
            deserializeJson(doc, value);
            delete influxClient;
            influxClient = NULL;
            INFLUXDB_URL = doc["url"].as<String>();
            INFLUXDB_ORG = doc["org"].as<String>();
            INFLUXDB_BUCKET = doc["bucket"].as<String>();
            INFLUXDB_TOKEN = doc["token"].as<String>();
        } else {
            Serial.printf("[InfluxDB] Unknown action type: %s\n", action);
            websocketCommands.send((char*)"[InfluxDB] Unknown action type");
            return;
        }

        if (INFLUXDB_ENABLED) {
            influxClient = new InfluxDBClient(INFLUXDB_URL, INFLUXDB_ORG, INFLUXDB_BUCKET, INFLUXDB_TOKEN, InfluxDbCloud2CACert);
            timeSync("CET-1CEST,M3.5.0,M10.5.0/3", "pool.ntp.org", "time.nis.gov");
            if (influxClient->validateConnection()) {
                websocketCommands.send((char*)"InfluxDB connection successful");
            } else {
                websocketCommands.send((char*)"InfluxDB connection failed");
                websocketCommands.send((char*)influxClient->getLastErrorMessage().c_str());
            }
        }
    });

    // Management
    websocketCommands.registerCmd((char*)"management", [](const char* _action, const char* _value) {
        String action = String(_action);
        String value = String(_value);
        if (action == "reboot") {
            resetFunc();
        } else if (action == "update") {
            WiFiClient client;
            ESPhttpUpdate.setLedPin(LED_BUILTIN, LOW);
            ESPhttpUpdate.onStart(update_started);
            ESPhttpUpdate.onEnd(update_finished);
            ESPhttpUpdate.onProgress(update_progress);
            ESPhttpUpdate.onError(update_error);

            String url;
            if (value == "latest" || value == "") {
                url = FIRMWARE_URL;
            } else {
                url = value;
            }

            String msg = "Updating firmware from ";
            msg += url;
            Serial.println(msg.c_str());
            websocketCommands.send((char*)msg.c_str());
            t_httpUpdate_return ret = ESPhttpUpdate.update(client, url);

            switch (ret) {
                case HTTP_UPDATE_FAILED: {
                    String msg = "HTTP_UPDATE_FAILED Error: (";
                    msg += ESPhttpUpdate.getLastError();
                    msg += "): ";
                    msg += ESPhttpUpdate.getLastErrorString();
                    Serial.println(msg.c_str());
                    websocketCommands.send((char*)msg.c_str());
                    break;
                } case HTTP_UPDATE_NO_UPDATES: {
                    Serial.println("HTTP_UPDATE_NO_UPDATES");
                    websocketCommands.send((char*)"No update available");
                    break;
                }
            }
        } else if (action == "wifi") {
            Serial.print("Updating wifi: ");
            int idx = value.indexOf(',');
            String ssid = value.substring(0, idx);
            String password = value.substring(idx + 1);
            Serial.printf("ssid=%s, password=%s\n", ssid.c_str(), password.c_str());
            WiFi.begin(ssid, password);

            // Wait some time to connect to wifi
            for (int i = 0; i < 30 && WiFi.status() != WL_CONNECTED; i++) {
                Serial.print("x");
                delay(1000);
            }
            Serial.println();

            if (WiFi.status() != WL_CONNECTED) {
                Serial.println("No Wifi! Retrying in loop...");
            }
        } else if (action == "info") {
            String response = String();
            JsonDocument doc;
            doc["version"] = VERSION;
            doc["ip"] = WiFi.localIP().toString();
            doc["mac"] = WiFi.macAddress();
            doc["ssid"] = WiFi.SSID();
            doc["rssi"] = WiFi.RSSI();
            doc["uptime"] = millis() / 1000;
            serializeJson(doc, response);
            websocketCommands.send((char*)response.c_str());
        } else  {
            Serial.printf("[Management] Unknown action type: %s\n", action);
            websocketCommands.send((char*)"[Management] Unknown action type");
        }
    });
}

void setup() {
    Serial.begin(115200);

    Serial.printf("\n\nWelcome to Arduponico v%s\n", VERSION);
    Serial.printf("Connecting to wifi: %s (%s)\n", WIFI_SSID, WIFI_PASSWORD);
    WiFi.mode(WIFI_STA); // FIXME: needs to be both: STA and AP
    WiFi.begin((char*)WIFI_SSID, (char*)WIFI_PASSWORD);
    // Wait some time to connect to wifi
    for (int i = 0; i < 30 && WiFi.status() != WL_CONNECTED; i++) {
        Serial.print("x");
        delay(1000);
    }
    Serial.println();

    // Check if connected to wifi
    // FIXME: Have the AP running to manage WiFi connection
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("No Wifi! Retrying in loop...");
    }

    setupCommands();

    phSensor.begin();
    ecSensor.begin(9600);

    phControl.DROP_TIME = 1000;
    phControl.ERR_MARGIN = 0.3;
    phControl.STABILIZATION_TIME = 10 * MINUTE;
    phControl.STABILIZATION_MARGIN = 0.1;
    phControl.setpoint = 5.8;
    ecUpControl.DROP_TIME = 10000;
    ecUpControl.ERR_MARGIN = 300;
    ecUpControl.STABILIZATION_TIME = 10 * MINUTE;
    ecUpControl.STABILIZATION_MARGIN = 100;
    ecUpControl.setpoint = 2000;

    // Influx clock sync
    if (INFLUXDB_ENABLED) {
        influxClient = new InfluxDBClient(INFLUXDB_URL, INFLUXDB_ORG, INFLUXDB_BUCKET, INFLUXDB_TOKEN, InfluxDbCloud2CACert);
        timeSync("CET-1CEST,M3.5.0,M10.5.0/3", "pool.ntp.org", "time.nis.gov");
        if (influxClient->validateConnection()) {
            Serial.print("Connected to InfluxDB: ");
            Serial.println(influxClient->getServerUrl());
        } else {
            Serial.print("InfluxDB connection failed: ");
            Serial.println(influxClient->getLastErrorMessage());
        }
    } else {
        Serial.println("InfluxDB disabled");
    }

    sensorReadingTimer = millis();
    influxSyncTimer = millis();
}

void loop() {
    websocketCommands.websocketJob();
    ecSensor.readSerial();
    if (ecSensor.sensorStringToWebsocket.length() > 0) {
        websocketCommands.send((char*)ecSensor.sensorStringToWebsocket.c_str());
        ecSensor.sensorStringToWebsocket = "";
    }

    if ((millis() - sensorReadingTimer) > SENSOR_READING_INTERVAL) {
        sensorReadingTimer = millis();

        float phReading = phSensor.read_ph();
        float phKalman = simpleKalmanPh.updateEstimate(phReading);
        phControl.current = phKalman;

        float ecReading = ecSensor.getReading();
        float ecKalman = simpleKalmanEc.updateEstimate(ecReading);
        ecUpControl.current = ecKalman;

        // Perform actual control
        int ph_control_direction = phControl.doControl();
        int ec_control_direction = ecUpControl.doControl();

        // Sync with influx
        if (INFLUXDB_ENABLED && (millis() - influxSyncTimer) > INFLUXDB_SYNC_COLD_DOWN) {
            influxSyncTimer = millis();
            autoponicoPoint.clearFields();
            autoponicoPoint.addField("ph_raw", phReading);
            autoponicoPoint.addField("ph_kalman", phKalman);
            autoponicoPoint.addField("ph_desired", phControl.setpoint);
            autoponicoPoint.addField("ec_raw", ecReading);
            autoponicoPoint.addField("ec_kalman", ecKalman);
            autoponicoPoint.addField("ec_desired", ecUpControl.setpoint);
            if (ph_control_direction != GOING_NONE) {
                autoponicoPoint.addField("ph_control_direction", ph_control_direction);
            }
            if (ec_control_direction != GOING_NONE) {
                autoponicoPoint.addField("ec_control_direction", ec_control_direction);
            }
            Serial.println("Writing to InfluxDB");
            if (!influxClient->writePoint(autoponicoPoint)) {
                Serial.print("InfluxDB write failed: ");
                Serial.println(influxClient->getLastErrorMessage());
            }
        }
    }
}
