#ifndef LED_BUILTIN
#define LED_BUILTIN 2  // Most ESP32 dev boards use GPIO 2 for the onboard LED
#endif

// Arduino included libraries
#include <WiFi.h>
#include <OneWire.h>

// Download from https://files.atlas-scientific.com/gravity-pH-ardunio-code.pdf
#include <ph_iso_grav.h>

// Install from library manager
#include <InfluxDbClient.h>
#include <InfluxDbCloud.h>
#include <SimpleKalmanFilter.h>
#include <ArduinoJson.h>
#include <DallasTemperature.h>

// Custom libraries
#include <AtlasSerialSensor.h>
#include <Control.h>
#include <WebsocketCommands.h>

#include "custom_libraries/RemoteFlasher.h"
#include "custom_libraries/FileManager.h"
#include "configuration.h"
#include "env.h"

void (*resetFunc)(void) = 0;  // create a standard reset function

// InfluxDB
bool INFLUXDB_ENABLED = false;
String INFLUXDB_URL = "";
String INFLUXDB_ORG = "";
String INFLUXDB_BUCKET = "";
String INFLUXDB_TOKEN = "";

InfluxDBClient* influxClient;
Point autoponicoPoint("cultivo");

// Websockets
WebsocketCommands websocketCommands;

// Ultrasonic sensor
const uint16_t TRIGGER_PIN = 4;
const uint16_t ECHO_PIN = 15;

// Control
ControlConfig phConfiguration = {
    21,           // M_UP_PIN
    19,           // M_DN_PIN
    200,          // M_UP_SPEED,
    200,          // M_DN_SPEED,
};
ControlConfig ecUpConfiguration = {
    18,           // M_UP_PIN
    0,            // M_DN_PIN,
    200,          // M_UP_SPEED,
    200,          // M_DN_SPEED,
};

Control phControl = Control(&phConfiguration);
Control ecUpControl = Control(&ecUpConfiguration);

// Ph sensor
Gravity_pH_Isolated phSensor = Gravity_pH_Isolated(5);
SimpleKalmanFilter* simpleKalmanPh;

// EC Sensor
AtlasSerialSensor ecSensor = AtlasSerialSensor(Serial2, 16, 17);
SimpleKalmanFilter* simpleKalmanEc;

// Temperature sensor
OneWire oneWire(22);
DallasTemperature tempSensor(&oneWire);

// Timers
unsigned long sensorReadingTimer;
unsigned long influxSyncTimer;

// Other variables
RemoteFlasher remoteFlasher(&websocketCommands);
FileManager* fileManager;

float readUltrasonicDistance(int triggerPin, int echoPin) {
  // Clear the trigger pin
  digitalWrite(triggerPin, LOW);
  delayMicroseconds(2);

  // Set the trigger pin high for 10 microseconds
  digitalWrite(triggerPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(triggerPin, LOW);

  // Read the echo pin, returns the sound wave travel time in microseconds, compute and return distance
  long duration = pulseIn(echoPin, HIGH);
  float distance = duration * 0.034 / 2;
  return distance;
}

float readTemperature() {
    tempSensor.requestTemperatures();
    return tempSensor.getTempCByIndex(0);
}

void setupCommands() {
    websocketCommands.init(WEBSOCKET_URL);

    pinMode(LED_BUILTIN, OUTPUT);
    pinMode(TRIGGER_PIN, OUTPUT);
    pinMode(ECHO_PIN, INPUT);

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
            float ph = phSensor.read_ph();
            String response = String();
            JsonDocument doc;
            doc["value"] = ph;
            doc["command"] = "ph";
            serializeJson(doc, response);
            websocketCommands.send((char*)response.c_str());
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
        if (action == "info") {
            String response = String();
            JsonDocument doc;
            doc["ph_setpoint"] = phControl.setpoint;
            doc["ph_auto"] = phControl.autoMode;
            doc["ph_drop_time"] = phControl.DROP_TIME;
            doc["ph_err_margin"] = phControl.ERR_MARGIN;
            doc["ph_stabilization_time"] = phControl.STABILIZATION_TIME;
            doc["ph_stabilization_margin"] = phControl.STABILIZATION_MARGIN;
            doc["ec_setpoint"] = ecUpControl.setpoint;
            doc["ec_auto"] = ecUpControl.autoMode;
            doc["ec_drop_time"] = ecUpControl.DROP_TIME;
            doc["ec_err_margin"] = ecUpControl.ERR_MARGIN;
            doc["ec_stabilization_time"] = ecUpControl.STABILIZATION_TIME;
            doc["ec_stabilization_margin"] = ecUpControl.STABILIZATION_MARGIN;
            doc["command"] = "control";
            serializeJson(doc, response);
            websocketCommands.send((char*)response.c_str());
            return;
        }

        if (action == "ph_up") {
            phControl.up(value.toInt());
            return;
        } else if (action == "ph_down") {
            phControl.down(value.toInt());
            return;
        } else if (action == "ph_drop_time") {
            phControl.DROP_TIME = value.toInt();
        } else if (action == "ph_err_margin") {
            phControl.ERR_MARGIN = value.toFloat();
        } else if (action == "ph_stabilization_time") {
            phControl.STABILIZATION_TIME = value.toInt();
        } else if (action == "ph_stabilization_margin") {
            phControl.STABILIZATION_MARGIN = value.toFloat();
        } else if (action == "ph_setpoint") {
            phControl.setpoint = value.toFloat();
        } else if (action == "ph_auto") {
            phControl.autoMode = value.toInt();
        } else if (action == "ec_up") {
            ecUpControl.up(value.toInt());
            return;
        // } else if (action == "ec_down") {
        //     ecUpControl.down(value.toInt());
        //     return;
        } else if (action == "ec_drop_time") {
            ecUpControl.DROP_TIME = value.toInt();
        } else if (action == "ec_err_margin") {
            ecUpControl.ERR_MARGIN = value.toFloat();
        } else if (action == "ec_stabilization_time") {
            ecUpControl.STABILIZATION_TIME = value.toInt();
        } else if (action == "ec_stabilization_margin") {
            ecUpControl.STABILIZATION_MARGIN = value.toFloat();
        } else if (action == "ec_setpoint") {
            ecUpControl.setpoint = value.toFloat();
        } else if (action == "ec_auto") {
            ecUpControl.autoMode = value.toInt();
        } else {
            Serial.printf("[Control] Unknown action type: %s\n", action);
            websocketCommands.send((char*)"[Control] Unknown action type");
            return;
        }
        fileManager->writeState(_action, _value);
    });

    // Kalman filters
    websocketCommands.registerCmd((char*)"kalman", [](const char* _action, const char* _value) {
        String action = String(_action);
        String value = String(_value);
        if (action == "info") {
            String response = String();
            JsonDocument doc;
            doc["ph_mea_error"] = simpleKalmanPh->getMeasurementError();
            doc["ph_est_error"] = simpleKalmanPh->getEstimateError();
            doc["ph_proc_noise"] = simpleKalmanPh->getProcessNoise();
            doc["ec_mea_error"] = simpleKalmanEc->getMeasurementError();
            doc["ec_est_error"] = simpleKalmanEc->getEstimateError();
            doc["ec_proc_noise"] = simpleKalmanEc->getProcessNoise();
            doc["command"] = "kalman";
            serializeJson(doc, response);
            websocketCommands.send((char*)response.c_str());
            return;
        }

        if (action == "ph_mea_error") {
            simpleKalmanPh->setMeasurementError(value.toFloat());
        } else if (action == "ph_est_error") {
            simpleKalmanPh->setEstimateError(value.toFloat());
        } else if (action == "ph_proc_noise") {
            simpleKalmanPh->setProcessNoise(value.toFloat());
        } else if (action == "ec_mea_error") {
            simpleKalmanEc->setMeasurementError(value.toFloat());
        } else if (action == "ec_est_error") {
            simpleKalmanEc->setEstimateError(value.toFloat());
        } else if (action == "ec_proc_noise") {
            simpleKalmanEc->setProcessNoise(value.toFloat());
        } else {
            Serial.printf("[Kalman] Unknown action type: %s\n", action);
            websocketCommands.send((char*)"[Kalman] Unknown action type");
            return;
        }
        fileManager->writeState(_action, _value);
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
            doc["command"] = "influxdb";
            serializeJson(doc, response);
            websocketCommands.send((char*)response.c_str());
            return;
        } else if (action == "update") {
            JsonDocument doc;
            deserializeJson(doc, value);
            delete influxClient;
            influxClient = NULL;
            INFLUXDB_ENABLED = doc["enabled"].as<String>() == "true";
            INFLUXDB_URL = doc["url"].as<String>();
            INFLUXDB_ORG = doc["org"].as<String>();
            INFLUXDB_BUCKET = doc["bucket"].as<String>();
            INFLUXDB_TOKEN = doc["token"].as<String>();
            fileManager->writeState("influxdb", value);
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
            String url;
            if (value == "latest" || value == "") {
                url = FIRMWARE_URL;
            } else {
                url = value;
            }
            remoteFlasher.updateFirmware(url);
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

            if (WiFi.status() == WL_CONNECTED) {
                fileManager->writeState("ssid", ssid);
                fileManager->writeState("password", password);
            } else {
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
            doc["distance"] = readUltrasonicDistance(TRIGGER_PIN, ECHO_PIN);
            doc["temperature"] = readTemperature();
            doc["command"] = "management";
            serializeJson(doc, response);
            websocketCommands.send((char*)response.c_str());
        } else  {
            Serial.printf("[Management] Unknown action type: %s\n", action);
            websocketCommands.send((char*)"[Management] Unknown action type");
        }
    });
}

void setupComponents() {
    phSensor.begin();
    ecSensor.begin();
    tempSensor.begin();

    // Wifi config
    String ssid = fileManager->readState("ssid", WIFI_SSID);
    String password = fileManager->readState("password", WIFI_PASSWORD);
    WiFi.mode(WIFI_STA); // FIXME: needs to be both: STA and AP

    Serial.printf("Connecting to wifi: %s (%s)\n", ssid, password);
    WiFi.begin(ssid, password);

    // Wait some time to connect to wifi
    for (int i = 0; i < 30 && WiFi.status() != WL_CONNECTED; i++) {
        Serial.print("x");
        delay(1000);
    }
    Serial.println();
    // FIXME: Have the AP running to manage WiFi connection
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("No Wifi! Retrying in loop...");
    }

    // pH Control config
    String ph_drop_time = fileManager->readState("ph_drop_time", "1000");
    String ph_err_margin = fileManager->readState("ph_err_margin", "0.3");
    String ph_stabilization_time = fileManager->readState("ph_stabilization_time", String(10 * MINUTE));
    String ph_stabilization_margin = fileManager->readState("ph_stabilization_margin", "0.1");
    String ph_setpoint = fileManager->readState("ph_setpoint", "5.8");
    String ph_auto_mode = fileManager->readState("ph_auto_mode", "0");

    phControl.DROP_TIME = ph_drop_time.toInt();
    phControl.ERR_MARGIN = ph_err_margin.toFloat();
    phControl.STABILIZATION_TIME = ph_stabilization_time.toInt();
    phControl.STABILIZATION_MARGIN = ph_stabilization_margin.toFloat();
    phControl.setpoint = ph_setpoint.toFloat();
    phControl.autoMode = ph_auto_mode.toInt();

    // EC Control config
    String ec_drop_time = fileManager->readState("ec_drop_time", "10000");
    String ec_err_margin = fileManager->readState("ec_err_margin", "300");
    String ec_stabilization_time = fileManager->readState("ec_stabilization_time", String(10 * MINUTE));
    String ec_stabilization_margin = fileManager->readState("ec_stabilization_margin", "100");
    String ec_setpoint = fileManager->readState("ec_setpoint", "2000");
    String ec_auto_mode = fileManager->readState("ec_auto_mode", "0");

    ecUpControl.DROP_TIME = ec_drop_time.toInt();
    ecUpControl.ERR_MARGIN = ec_err_margin.toFloat();
    ecUpControl.STABILIZATION_TIME = ec_stabilization_time.toInt();
    ecUpControl.STABILIZATION_MARGIN = ec_stabilization_margin.toFloat();
    ecUpControl.setpoint = ec_setpoint.toFloat();
    ecUpControl.autoMode = ec_auto_mode.toInt();

    // Kalman config
    String ph_mea_error = fileManager->readState("ph_mea_error", "2");
    String ph_est_error = fileManager->readState("ph_est_error", "2");
    String ph_proc_noise = fileManager->readState("ph_proc_noise", "0.01");
    simpleKalmanPh = new SimpleKalmanFilter(
        ph_mea_error.toFloat(),
        ph_est_error.toFloat(),
        ph_proc_noise.toFloat()
    );

    String ec_mea_error = fileManager->readState("ec_mea_error", "2");
    String ec_est_error = fileManager->readState("ec_est_error", "2");
    String ec_proc_noise = fileManager->readState("ec_proc_noise", "0.01");
    simpleKalmanEc = new SimpleKalmanFilter(
        ec_mea_error.toFloat(),
        ec_est_error.toFloat(),
        ec_proc_noise.toFloat()
    );

    // InfluxDB config
    JsonDocument doc;
    doc["enabled"] = INFLUXDB_ENABLED;
    doc["url"] = INFLUXDB_URL;
    doc["org"] = INFLUXDB_ORG;
    doc["bucket"] = INFLUXDB_BUCKET;
    doc["token"] = INFLUXDB_TOKEN;
    String defaultValue = String();
    serializeJson(doc, defaultValue);
    String influxdb = fileManager->readState("influxdb", defaultValue);
    deserializeJson(doc, influxdb);

    INFLUXDB_ENABLED = doc["enabled"].as<String>() == "true";
    INFLUXDB_URL = doc["url"].as<String>();
    INFLUXDB_ORG = doc["org"].as<String>();
    INFLUXDB_BUCKET = doc["bucket"].as<String>();
    INFLUXDB_TOKEN = doc["token"].as<String>();
}

void setup() {
    Serial.begin(115200);
    delay(2000);
    Serial.printf("\n\nWelcome to Arduponico v%s\n", VERSION);

    fileManager = new FileManager();

    setupComponents();
    setupCommands();

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
        String response = String();
        JsonDocument doc;
        doc["value"] = ecSensor.sensorStringToWebsocket;
        doc["command"] = "ec";
        serializeJson(doc, response);
        websocketCommands.send((char*)response.c_str());
        ecSensor.sensorStringToWebsocket = "";
    }

    if ((millis() - sensorReadingTimer) > SENSOR_READING_INTERVAL) {
        sensorReadingTimer = millis();

        float phReading = phSensor.read_ph();
        float phKalman = simpleKalmanPh->updateEstimate(phReading);
        phControl.current = phKalman;

        float ecReading = ecSensor.getReading();
        float ecKalman = simpleKalmanEc->updateEstimate(ecReading);
        ecUpControl.current = ecKalman;

        float distance = readUltrasonicDistance(TRIGGER_PIN, ECHO_PIN);
        float temperature = readTemperature();

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
            if (distance > 0) {
                autoponicoPoint.addField("distance", distance);
            }
            if (temperature != DEVICE_DISCONNECTED_C) {
                autoponicoPoint.addField("temperature", temperature);
            }
            Serial.println("Writing to InfluxDB");
            if (!influxClient->writePoint(autoponicoPoint)) {
                Serial.print("InfluxDB write failed: ");
                Serial.println(influxClient->getLastErrorMessage());
            }
        }
    }
}
