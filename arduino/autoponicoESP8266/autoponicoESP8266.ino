// Arduino included libraries
#include <ESP8266WiFi.h>

// Download from https://files.atlas-scientific.com/gravity-pH-ardunio-code.pdf
#include <ph_iso_grav.h>

// Install from library manager
#include <SimpleKalmanFilter.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <ArduinoWebsockets.h>
#include <InfluxDbClient.h>
#include <InfluxDbCloud.h>

// Custom libraries
#include <Control.h>
#include <AtlasSerialSensor.h>
#include <WebsocketCommands.h>

#include "configuration.h"
#include "env.h"


InfluxDBClient influxClient(INFLUXDB_URL, INFLUXDB_ORG, INFLUXDB_BUCKET, INFLUXDB_TOKEN, InfluxDbCloud2CACert);
Point autoponicoPoint("cultivo");

// Wifi
const char *ssid = WIFI_SSID;
const char *password = WIFI_PASSWORD;

// Websockets
WebsocketCommands websocketCommands;

// Control
ControlConfig phConfiguration = {
    0,           // POT_PIN
    5,           // M_UP, D1
    4,           // M_DN, D2
    200,         // M_UP_SPEED,
    200,         // M_DN_SPEED,
    0,           // ZERO_SPEED,
    1000,        // DROP_TIME,
    0.3,         // ERR_MARGIN,
    10 * MINUTE, // STABILIZATION_TIME,
    0.1,         // STABILIZATION_MARGIN
    5 * 10,      // MAX_DESIRED_MEASURE
    7 * 10       // MIN_DESIRED_MEASURE
};
ControlConfig ecUpConfiguration = {
    0,           // POT_PIN
    2,           // M_UP, D4
    0,           // M_DN,
    200,         // M_UP_SPEED,
    200,         // M_DN_SPEED,
    0,           // ZERO_SPEED,
    10000,       // DROP_TIME,
    300,         // ERR_MARGIN,
    10 * MINUTE, // STABILIZATION_TIME,
    100,         // STABILIZATION_MARGIN
    0,           // MAX_DESIRED_MEASURE 0 if POT_PIN=0
    0            // MIN_DESIRED_MEASURE 0 if POT_PIN=0
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

void setup()
{
  Serial.begin(57600);
  Serial.setDebugOutput(true);
  // Connect to wifi
  WiFi.begin(ssid, password);

  websocketCommands.setSocketUrl((char*)PISOCKET_URL);
  websocketCommands.init();
  websocketCommands.registerCmd((char*)"ph", []()
                                { websocketCommands.send(strcat((char*)"ph: ", String(phSensor.read_ph()).c_str())); });

  phSensor.begin();
  sensorDS18B20.begin();
  ecSensor.begin(9600);

  phControl.setManualMode(false);
  phControl.setSetPoint(5.7); // FIXME: make this setable from websocket (read from EEPROM?)
  phControl.setReadSetPointFromCMD(true);

  ecUpControl.setManualMode(false);
  ecUpControl.setSetPoint(3000); // FIXME: make this setable from websocket (read from EEPROM?)
  ecUpControl.setReadSetPointFromCMD(true);

  sensorReadingTimer = millis();
  influxSyncTimer = millis();

  // Influx
  timeSync(TZ_INFO, "pool.ntp.org", "time.nis.gov");
  // Check server connection
  if (influxClient.validateConnection())
  {
    Serial.println("Connected to InfluxDB: ");
    Serial.println(influxClient.getServerUrl());
  }
  else
  {
    Serial.println("InfluxDB connection failed: ");
    Serial.println(influxClient.getLastErrorMessage());
  }
}

void loop()
{
  websocketCommands.websocketJob();
  ecSensor.readSerial();
  if ((millis() - sensorReadingTimer) > SENSOR_READING_INTERVAL)
  {
    sensorDS18B20.requestTemperatures();
    sensorReadingTimer = millis();

    float ecReading = ecSensor.getReading();
    float ecKalman = simpleKalmanEc.updateEstimate(ecReading);
    ecUpControl.setCurrent(ecKalman);
    float ecSetpoint = ecUpControl.getSetPoint();
    ecUpControl.calculateError();

    float phReading = phSensor.read_ph();
    float phKalman = simpleKalmanPh.updateEstimate(phReading);
    phControl.setCurrent(phKalman);
    float phSetpoint = phControl.getSetPoint();
    phControl.calculateError();

    // Perform actual control
    int ph_control_direction = phControl.doControl();
    int ec_control_direction = ecUpControl.doControl();

    // Sync with influx
    if ((millis() - influxSyncTimer) > INFLUXDB_SYNC_COLD_DOWN)
    {
      influxSyncTimer = millis();
      autoponicoPoint.clearFields();
      autoponicoPoint.addField("ph_kalman", phKalman);
      autoponicoPoint.addField("ph_desired", phSetpoint);
      autoponicoPoint.addField("ec_kalman", ecKalman);
      autoponicoPoint.addField("ec_desired", ecSetpoint);
      autoponicoPoint.addField("ph_control_direction", ph_control_direction);
      autoponicoPoint.addField("ec_control_direction", ec_control_direction);
      autoponicoPoint.addField("temp", sensorDS18B20.getTempCByIndex(0));
      writePoints(autoponicoPoint);
    }
  }
}

void writePoints(Point point)
{
  // Write points
  if (!influxClient.writePoint(point))
  {
    Serial.print("InfluxDB write failed: ");
    Serial.println(influxClient.getLastErrorMessage());
  }
}