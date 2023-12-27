// Arduino included libraries
#include <ESP8266WiFi.h>

// Download from https://files.atlas-scientific.com/gravity-pH-ardunio-code.pdf
#include <ph_iso_grav.h>

// Install from library manager
#include <ArduinoWebsockets.h>
#include <DallasTemperature.h>
#include <InfluxDbClient.h>
#include <InfluxDbCloud.h>
#include <OneWire.h>
#include <SimpleKalmanFilter.h>

// Custom libraries
#include <AtlasSerialSensor.h>
#include <Control.h>
#include <WebsocketCommands.h>

#include "configuration.h"
#include "env.h"

InfluxDBClient influxClient(INFLUXDB_URL, INFLUXDB_ORG, INFLUXDB_BUCKET, INFLUXDB_TOKEN, InfluxDbCloud2CACert);
Point autoponicoPoint("cultivo");

// Websockets
WebsocketCommands websocketCommands;

// Control
ControlConfig phConfiguration = {
    0,            // POT_PIN
    5,            // M_UP, D1
    4,            // M_DN, D2
    200,          // M_UP_SPEED,
    200,          // M_DN_SPEED,
    0,            // ZERO_SPEED,
    1000,         // DROP_TIME,
    0.3,          // ERR_MARGIN,
    10 * MINUTE,  // STABILIZATION_TIME,
    0.1,          // STABILIZATION_MARGIN
    5 * 10,       // MAX_DESIRED_MEASURE
    7 * 10        // MIN_DESIRED_MEASURE
};
ControlConfig ecUpConfiguration = {
    0,            // POT_PIN
    2,            // M_UP, D4
    0,            // M_DN,
    200,          // M_UP_SPEED,
    200,          // M_DN_SPEED,
    0,            // ZERO_SPEED,
    10000,        // DROP_TIME,
    300,          // ERR_MARGIN,
    10 * MINUTE,  // STABILIZATION_TIME,
    100,          // STABILIZATION_MARGIN
    0,            // MAX_DESIRED_MEASURE 0 if POT_PIN=0
    0             // MIN_DESIRED_MEASURE 0 if POT_PIN=0
};

Control phControl = Control(&phConfiguration);
Control ecUpControl = Control(&ecUpConfiguration);

// Temp sensor
OneWire oneWireObject(TEMPERATURE_PIN);
DallasTemperature sensorDS18B20(&oneWireObject);

// EC Sensor
AtlasSerialSensor ecSensor = AtlasSerialSensor(EC_RX, EC_TX);
SimpleKalmanFilter simpleKalmanEc(2, 2, 0.01);

// Ph sensor
Gravity_pH phSensor = Gravity_pH(GRAV_PH_PIN);
SimpleKalmanFilter simpleKalmanPh(2, 2, 0.01);

unsigned long sensorReadingTimer;
unsigned long influxSyncTimer;

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
    websocketCommands.registerCmd((char*)"atlas-gravity", [](char* message) {
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
            websocketCommands.send(String(phSensor.read_ph()).c_str());
        } else {
            Serial.printf("Unknown action type: %s\n", message);
        }
    });

    // Bypass websocket message to atlas' EZO UART eg "ec-serial Cal,n"
    websocketCommands.registerCmd((char*)"ec-serial", [](char* message) {
        Serial.println("Not implemented");
        // ecSensor.sendSerial(message)
        // ...and send response to websocket
    });

    // Control
    websocketCommands.registerCmd((char*)"control", [](char* message) {
        Serial.println("Not implemented");
        // TODO: dose manually eg "control ec up 100"/"control ph down 1000"
        // TODO: set ph/ec setpoints eg "control ph setpoint 5.7"
        // phControl.setSetPoint(5.7);

        // TODO: change mode to always allow manual dose, enable/disable auto mode
        // phControl.setManualMode(false);

        // send temperature
    });

    // Management
    websocketCommands.registerCmd((char*)"management", [](char* message) {
        Serial.println("Not implemented");
        // Request variables
        // Request reboot?
        // Update wifi?
    }

}

void setup() {
    Serial.begin(115200);

    Serial.printf("Connecting to wifi: %s\n", WIFI_SSID);
    WiFi.begin((char*)WIFI_SSID, (char*)WIFI_PASSWORD);
    // Wait some time to connect to wifi
    for(int i = 0; i < 10 && WiFi.status() != WL_CONNECTED; i++) {
        Serial.print("x");
        delay(1000);
    }

    // Check if connected to wifi
    if(WiFi.status() != WL_CONNECTED) {
        Serial.println("No Wifi!");
        return;
    }

    setupCommands();

    phSensor.begin();
    sensorDS18B20.begin();
    ecSensor.begin(9600);

    phControl.setManualMode(false);
    phControl.setSetPoint(5.7);  // FIXME: make this setable from websocket (read from EEPROM?)
    phControl.setReadSetPointFromCMD(true);

    ecUpControl.setManualMode(false);
    ecUpControl.setSetPoint(3000);  // FIXME: make this setable from websocket (read from EEPROM?)
    ecUpControl.setReadSetPointFromCMD(true);

    sensorReadingTimer = millis();
    influxSyncTimer = millis();

    // Influx clock sync
    timeSync("CET-1CEST,M3.5.0,M10.5.0/3", "pool.ntp.org", "time.nis.gov");
    if (influxClient.validateConnection()) {
        Serial.print("Connected to InfluxDB: ");
        Serial.println(influxClient.getServerUrl());
    } else {
        Serial.print("InfluxDB connection failed: ");
        Serial.println(influxClient.getLastErrorMessage());
    }
}

void loop() {
    websocketCommands.websocketJob();
    ecSensor.readSerial();

    if ((millis() - sensorReadingTimer) > SENSOR_READING_INTERVAL) {
        sensorDS18B20.requestTemperatures();
        sensorReadingTimer = millis();

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
            autoponicoPoint.addField("ph_control_direction", ph_control_direction);
            autoponicoPoint.addField("ec_control_direction", ec_control_direction);
            autoponicoPoint.addField("temp", sensorDS18B20.getTempCByIndex(0));
            writePoints(autoponicoPoint);
        }
    }
}

void writePoints(Point point) {
    if (!influxClient.writePoint(point)) {
        Serial.print("InfluxDB write failed: ");
        Serial.println(influxClient.getLastErrorMessage());
    }
}
