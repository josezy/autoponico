
#include <ArduinoWebsockets.h>
#include <ESP8266WiFi.h>
#include "ph_iso_grav.h"
#include "SimpleKalmanFilter.h"

#include "Control.h"
#include "AtlasSerialSensor.h"
#include "OneWire.h"
#include "DallasTemperature.h"

#include <InfluxDbClient.h>
#include <InfluxDbCloud.h>
#include "env.h"

#define MINUTE 1000L * 60
#define SENSOR_READING_INTERVAL 1000

#define INFLUXDB_SYNC_COLD_DOWN 1 * MINUTE
InfluxDBClient influxClient(INFLUXDB_URL, INFLUXDB_ORG, INFLUXDB_BUCKET, INFLUXDB_TOKEN, InfluxDbCloud2CACert);
Point basilPoints("basil");

// Wifi
const char *ssid = WIFI_SSID;         // Enter SSID
const char *password = WIFI_PASSWORD; // Enter Password

// Websockets
const char *websockets_connection_string = "wss://free.blr2.piesocket.com/v3/1?api_key=nUiffYRr0FGxT0S3d1MjTlTyVCV2s5RQCzfzJJIn&notify_self=1"; // Enter server adress
using namespace websockets;
WebsocketsClient webSocketClient;
enum websocketState
{
  WS_DISCONNECTED,
  WS_CONNECTING,
  WS_CONNECTED
} websocketState = WS_DISCONNECTED;

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
Control phControl = Control(&phConfiguration);

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
Control ecUpControl = Control(&ecUpConfiguration);

// Temp sensor
#define TEMPERATURE_PIN 14 // D5
OneWire oneWireObject(TEMPERATURE_PIN);
DallasTemperature sensorDS18B20(&oneWireObject);
// EC Sensor
#define EC_RX 12 // D6
#define EC_TX 13 // D7
AtlasSerialSensor ecSensor = AtlasSerialSensor(EC_RX, EC_TX);
SimpleKalmanFilter simpleKalmanEc(2, 2, 0.01);
// Ph sensor
#define GRAV_PH_PIN 15 // D8
Gravity_pH phSensor = Gravity_pH(GRAV_PH_PIN);
SimpleKalmanFilter simpleKalmanPh(2, 2, 0.01);

void onMessageCallback(WebsocketsMessage message)
{
  Serial.print("Got Message: ");
  Serial.println(message.data());
  if (message.data() == "status")
  {
    webSocketClient.send("Ph: " + String(phSensor.read_ph()) + "\n");
    webSocketClient.send("EC: " + String(ecSensor.getReading()) + "\n");
  }
}

void onEventsCallback(WebsocketsEvent event, String data)
{

  if (event == WebsocketsEvent::ConnectionOpened)
  {
    Serial.println("Connnection Opened");
    websocketState = WS_CONNECTED;
  }
  else if (event == WebsocketsEvent::ConnectionClosed)
  {
    Serial.println("Connnection Closed");
    websocketState = WS_DISCONNECTED;
  }
  else if (event == WebsocketsEvent::GotPing)
  {
    Serial.println("Got a Ping!");
  }
  else if (event == WebsocketsEvent::GotPong)
  {
    Serial.println("Got a Pong!");
  }
}

void websocketJob()
{
  if (
      websocketState == WS_DISCONNECTED &&
      websocketState != WS_CONNECTING &&
      WiFi.waitForConnectResult() == WL_CONNECTED)
  {
    Serial.println("Connecting to Websockets server...");
    websocketState = WS_CONNECTING;
    webSocketClient.connect(websockets_connection_string);
    // Send a message
    webSocketClient.send("Hello Server");
    // Send a ping
    webSocketClient.ping();
  }
  else if (websocketState == WS_CONNECTED)
    webSocketClient.poll();
  if (WiFi.waitForConnectResult() != WL_CONNECTED)
    websocketState = WS_DISCONNECTED;
}

unsigned long sensorReadingTimer;
unsigned long influxSyncTimer;

void setup()
{
  Serial.begin(57600);
  Serial.setDebugOutput(true);
  // Connect to wifi
  WiFi.begin(ssid, password);

  // run callback when messages are received
  webSocketClient.onMessage(onMessageCallback);
  // run callback when events are occuring
  webSocketClient.onEvent(onEventsCallback);
  // Before connecting, set the ssl fingerprint of the server
  // webSocketClient.setFingerprint(echo_org_ssl_fingerprint);
  webSocketClient.setInsecure();

  phSensor.begin();
  sensorDS18B20.begin();
  ecSensor.begin(9600);

  phControl.setManualMode(false);
  phControl.setSetPoint(5.7);
  phControl.setReadSetPointFromCMD(true);

  ecUpControl.setManualMode(false);
  ecUpControl.setSetPoint(3000);
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
  websocketJob();
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
    // Do control
    int going = phControl.doControl();
    int goingEc = ecUpControl.doControl();
    // Sync with influx
    if ((millis() - influxSyncTimer) > INFLUXDB_SYNC_COLD_DOWN)
    {
      influxSyncTimer = millis();
      basilPoints.clearFields();
      basilPoints.addField("ph_kalman", phKalman);
      basilPoints.addField("ph_desired", phSetpoint);
      basilPoints.addField("ec_kalman", ecKalman);
      basilPoints.addField("ec_desired", ecSetpoint);
      basilPoints.addField("temp", sensorDS18B20.getTempCByIndex(0));
      writePoints(basilPoints);
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
