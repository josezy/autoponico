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

// Custom libraries
#include <AtlasSerialSensor.h>
#include <Control.h>
#include <WebsocketCommands.h>

#include "configuration.h"
#include "env.h"

void (*resetFunc)(void) = 0;  // create a standard reset function

InfluxDBClient influxClient(INFLUXDB_URL, INFLUXDB_ORG, INFLUXDB_BUCKET, INFLUXDB_TOKEN, InfluxDbCloud2CACert);
Point autoponicoPoint("cultivo");

// Websockets
WebsocketCommands websocketCommands;

// Control
ControlConfig phConfiguration = {
    0,            // POT_PIN
    D1,           // M_UP_PIN
    D2,           // M_DN_PIN
    200,          // M_UP_SPEED,
    200,          // M_DN_SPEED,
    0,            // ZERO_SPEED,
    1000,         // DROP_TIME,
    0.3,          // ERR_MARGIN,
    10 * MINUTE,  // STABILIZATION_TIME,
    0.1,          // STABILIZATION_MARGIN
};
ControlConfig ecUpConfiguration = {
    0,            // POT_PIN
    D8,           // M_UP_PIN
    0,            // M_DN_PIN,
    200,          // M_UP_SPEED,
    200,          // M_DN_SPEED,
    0,            // ZERO_SPEED,
    10000,        // DROP_TIME,
    300,          // ERR_MARGIN,
    10 * MINUTE,  // STABILIZATION_TIME,
    100,          // STABILIZATION_MARGIN
};

Control phControl = Control(&phConfiguration);
Control ecUpControl = Control(&ecUpConfiguration);

// Temp sensor
// OneWire oneWireObject(D8);
// DallasTemperature sensorDS18B20(&oneWireObject);

// EC Sensor
AtlasSerialSensor ecSensor = AtlasSerialSensor(D7, D6);
SimpleKalmanFilter simpleKalmanEc(2, 2, 0.01);

// Ph sensor
Gravity_pH phSensor = Gravity_pH(D5);
SimpleKalmanFilter simpleKalmanPh(2, 2, 0.01);

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
    websocketCommands.init((char*)WEBSOCKET_URL);

    pinMode(LED_BUILTIN, OUTPUT);
    websocketCommands.registerCmd((char*)"ping", [](char* message) {
        Serial.printf("Sending pong: %s\n", message);
        websocketCommands.send((char*)"pong");
        if (strcmp(message, "on") == 0) {
            digitalWrite(LED_BUILTIN, LOW);
        } else if (strcmp(message, "off") == 0) {
            digitalWrite(LED_BUILTIN, HIGH);
        }
    });

    // Manage Analog Gravity pH
    websocketCommands.registerCmd((char*)"ph", [](char* message) {
        String action = String(message);

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
            Serial.printf("[Atlas Gravity] Unknown action type: %s\n", message);
        }
    });

    // Bypass websocket message to atlas' EZO UART eg "ec-serial Cal,n"
    websocketCommands.registerCmd((char*)"ec", [](char* message) {
        ecSensor.sendSerial(String(message));
    });

    // Control
    websocketCommands.registerCmd((char*)"control", [](char* message) {
        String strMessage = String(message);
        int index = strMessage.indexOf(' ');
        String action = strMessage.substring(0, index);
        String value = strMessage.substring(index);

        if (action == "ph_up") {
            phControl.up(value.toInt());
        } else if (action == "ph_down") {
            phControl.down(value.toInt());
        } else if (action == "ph_setpoint") {
            phControl.setSetPoint(value.toFloat());
        } else if (action == "ph_auto") {
            phControl.setAutoMode(value.toInt());
        } else if (action == "ec_up") {
            ecUpControl.up(value.toInt());
        } else if (action == "ec_down") {
            ecUpControl.down(value.toInt());
        } else if (action == "ec_setpoint") {
            ecUpControl.setSetPoint(value.toFloat());
        } else if (action == "ec_auto") {
            ecUpControl.setAutoMode(value.toInt());
        } else if (action == "info") {
            String msg = "ph_setpoint:";
            msg += phControl.getSetPoint();
            msg += ",ph_auto:";
            msg += phControl.getAutoMode();
            msg += ",ec_setpoint:";
            msg += ecUpControl.getSetPoint();
            msg += ",ec_auto:";
            msg += ecUpControl.getAutoMode();
            // TODO: add more relevant info, find a better way to arrange state
            websocketCommands.send((char*)msg.c_str());
        } else {
            Serial.printf("[Control] Unknown action type: %s\n", message);
        }
    });

    // Management
    websocketCommands.registerCmd((char*)"management", [](char* message) {
        String strMessage = String(message);
        int index = strMessage.indexOf(' ');
        String action = strMessage.substring(0, index);
        String value = strMessage.substring(index);

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
            websocketCommands.send((char*)"Not implemented");
            // TODO: Update wifi
        } else if (action == "info") {
            String response = String();
            response += String("VERSION:");
            response += String(VERSION);
            response += String(",IP:");
            response += WiFi.localIP().toString();
            response += String(",MAC:");
            response += WiFi.macAddress();
            response += String(",SSID:");
            response += WiFi.SSID();
            response += String(",RSSI:");
            response += WiFi.RSSI();
            websocketCommands.send((char*)response.c_str());
        } else if (action == "influxdb") {
            String response = String();
            response += String("INFLUXDB_ENABLED:");
            response += String(INFLUXDB_ENABLED);
            response += String(",INFLUXDB_URL:");
            response += String(INFLUXDB_URL);
            response += String(",INFLUXDB_ORG:");
            response += String(INFLUXDB_ORG);
            response += String(",INFLUXDB_BUCKET:");
            response += String(INFLUXDB_BUCKET);
            response += String(",INFLUXDB_TOKEN:");
            response += String(INFLUXDB_TOKEN);
            websocketCommands.send((char*)response.c_str());
        } else {
            Serial.printf("[Management] Unknown action type: %s\n", message);
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
    // sensorDS18B20.begin();
    ecSensor.begin(9600);

    phControl.setSetPoint(5.8);  // FIXME: make this setable from websocket (store in memory)
    ecUpControl.setSetPoint(3000);  // FIXME: make this setable from websocket (store in memory)

    sensorReadingTimer = millis();
    influxSyncTimer = millis();

    // Influx clock sync
    if (INFLUXDB_ENABLED) {
        timeSync("CET-1CEST,M3.5.0,M10.5.0/3", "pool.ntp.org", "time.nis.gov");
        if (influxClient.validateConnection()) {
            Serial.print("Connected to InfluxDB: ");
            Serial.println(influxClient.getServerUrl());
        } else {
            Serial.print("InfluxDB connection failed: ");
            Serial.println(influxClient.getLastErrorMessage());
        }
    } else {
        Serial.println("InfluxDB disabled");
    }
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
        // sensorDS18B20.requestTemperatures();

        float ecReading = ecSensor.getReading();
        float ecKalman = simpleKalmanEc.updateEstimate(ecReading);
        ecUpControl.setCurrent(ecKalman);
        float ecSetpoint = ecUpControl.getSetPoint();

        float phReading = phSensor.read_ph();
        float phKalman = simpleKalmanPh.updateEstimate(phReading);
        phControl.setCurrent(phKalman);
        float phSetpoint = phControl.getSetPoint();

        // Perform actual control
        int ph_control_direction = phControl.doControl();
        int ec_control_direction = ecUpControl.doControl();

        // Sync with influx
        if (INFLUXDB_ENABLED && (millis() - influxSyncTimer) > INFLUXDB_SYNC_COLD_DOWN) {
            influxSyncTimer = millis();
            autoponicoPoint.clearFields();
            autoponicoPoint.addField("ph_raw", phReading);
            autoponicoPoint.addField("ph_kalman", phKalman);
            autoponicoPoint.addField("ph_desired", phSetpoint);
            autoponicoPoint.addField("ec_raw", ecReading);
            autoponicoPoint.addField("ec_kalman", ecKalman);
            autoponicoPoint.addField("ec_desired", ecSetpoint);
            if (ph_control_direction != GOING_NONE) {
                autoponicoPoint.addField("ph_control_direction", ph_control_direction);
            }
            if (ec_control_direction != GOING_NONE) {
                autoponicoPoint.addField("ec_control_direction", ec_control_direction);
            }
            // autoponicoPoint.addField("temp", sensorDS18B20.getTempCByIndex(0));
            if (!influxClient.writePoint(autoponicoPoint)) {
                Serial.print("InfluxDB write failed: ");
                Serial.println(influxClient.getLastErrorMessage());
            }
        }
    }
}
