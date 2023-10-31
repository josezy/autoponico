
#include <ArduinoWebsockets.h>
#include <ESP8266WiFi.h>
#include "ph_iso_grav.h"
#include "SimpleKalmanFilter.h"

#include "Control.h"
#include "AtlasSerialSensor.h"
#include "OneWire.h"
#include "DallasTemperature.h"

#define MINUTE 1000L * 60

const char *ssid = "SSID_NAME";                                                                                                                    // Enter SSID
const char *password = "SSID_PASS";                                                                                                              // Enter Password
const char *websockets_connection_string = "PISOCKET_URL"; // Enter server adress
using namespace websockets;
WebsocketsClient client;

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
  if (message.data() == "status"){
    client.send("Ph: "+String(phSensor.read_ph())+"\n");
    client.send("EC: "+String(ecSensor.getReading())+"\n");
  }
}

void onEventsCallback(WebsocketsEvent event, String data)
{

  if (event == WebsocketsEvent::ConnectionOpened)
  {
    Serial.println("Connnection Opened");
  }
  else if (event == WebsocketsEvent::ConnectionClosed)
  {
    Serial.println("Connnection Closed");
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

unsigned long lastMillis;

void setup()
{
  Serial.begin(115200);
  Serial.setDebugOutput(true);
  // Connect to wifi
  WiFi.begin(ssid, password);
  // Wait some time to connect to wifi
  for (int i = 0; i < 10 && WiFi.status() != WL_CONNECTED; i++)
  {
    Serial.print(".");
    delay(1000);
  }
  // run callback when messages are received
  client.onMessage(onMessageCallback);
  // run callback when events are occuring
  client.onEvent(onEventsCallback);
  // Before connecting, set the ssl fingerprint of the server
  // client.setFingerprint(echo_org_ssl_fingerprint);
  client.setInsecure();
  // Connect to server
  client.connect(websockets_connection_string);
  // Send a message
  client.send("Hello Server");
  // Send a ping
  client.ping();

  phSensor.begin();
  sensorDS18B20.begin();

  phControl.setManualMode(false);
  phControl.setSetPoint(5.7);
  phControl.setReadSetPointFromCMD(true);

  ecUpControl.setManualMode(false);
  ecUpControl.setSetPoint(3000);
  ecUpControl.setReadSetPointFromCMD(true);

  lastMillis = millis();
}

void loop()
{
  client.poll();
  if ((millis() - lastMillis) > 1000)
  {
    lastMillis = millis();
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
    Serial.println(String(phReading));
    Serial.println(String(ecReading));
  }
  int going = phControl.doControl();
  int goingEc = ecUpControl.doControl();
}
