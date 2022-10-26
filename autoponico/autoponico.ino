
#include "Control.h"
#include "Displays74HC595.h"
#include "AtlasSerialSensor.h"
#include "SensorEEPROM.h"
#include "SerialCom.h"
#include "ph_grav.h"
#include <SimpleKalmanFilter.h>
#include "measureDistance.h"

#define WHOAMI "PH"
SensorEEPROM sensorEEPROM = SensorEEPROM(WHOAMI);

#define MINUTE 1000L * 60
#define POT_PIN A1
#define M_UP 8
#define M_DN 9
#define M_UP_SPEED 200
#define M_DN_SPEED 200
#define ZERO_SPEED 0
#define STABILIZATION_MARGIN 0.1
#define ERR_MARGIN 0.3
#define STABILIZATION_TIME 10 * MINUTE
#define DROP_TIME 1000
#define MAX_DESIRED_MEASURE 5 * 10
#define MIN_DESIRED_MEASURE 7 * 10

ControlConfig configuration = {
    POT_PIN,
    M_UP,
    M_DN,
    M_UP_SPEED,
    M_DN_SPEED,
    ZERO_SPEED,
    DROP_TIME,
    ERR_MARGIN,
    STABILIZATION_TIME,
    STABILIZATION_MARGIN,
    MAX_DESIRED_MEASURE,
    MIN_DESIRED_MEASURE};
Control phControl = Control(&configuration);

#define CURRENT_SEG7_DATA 2
#define CURRENT_SEG7_CLOCK 3
#define CURRENT_SEG7_LATCH 4

Displays74HC595 displays = Displays74HC595(
    CURRENT_SEG7_DATA, CURRENT_SEG7_CLOCK, CURRENT_SEG7_LATCH);

#define EC_RX 10
#define EC_TX 11
AtlasSerialSensor ecSensor = AtlasSerialSensor(EC_RX, EC_TX);

#define GRAV_PH_PIN A0
Gravity_pH phSensor = Gravity_pH(GRAV_PH_PIN);

SerialCom serialCom = SerialCom(&sensorEEPROM, &phControl);

 /*
 SimpleKalmanFilter(e_mea, e_est, q);
 e_mea: Measurement Uncertainty 
 e_est: Estimation Uncertainty 
 q: Process Noise
 */
SimpleKalmanFilter simpleKalmanFilter(2, 2, 0.01);

#define LVL_TRG_PIN 5
#define LVL_ECHO_PIN 6
MeasureDistance* measureDistance = new MeasureDistance(LVL_TRG_PIN,LVL_ECHO_PIN);


unsigned long lastMillis;
unsigned int SERIAL_PERIOD = 1 * MINUTE;

void setup() {
    phSensor.begin();
    serialCom.init();
    phControl.setManualMode(false);
    phControl.setSetPoint(sensorEEPROM.getPh());
    phControl.setReadSetPointFromCMD(sensorEEPROM.readFromCmd());
    lastMillis = millis();
    pinMode(13, OUTPUT);
    digitalWrite(13, HIGH);
    serialCom.printTask("PH", "START", 1);
}

void loop() {
    float ecReading = ecSensor.getReading();

    float phReading = phSensor.read_ph();
    float phKalman = simpleKalmanFilter.updateEstimate(phReading);

    phControl.setCurrent(phKalman);

    float phSetpoint = phControl.getSetPoint();
    
    phControl.calculateError();

    displays.display(phReading);
    serialCom.checkForCommand();
    if ((millis() - lastMillis) > SERIAL_PERIOD) {
        lastMillis = millis();
        serialCom.printTask("EC", "READ", ecReading);
        delay(20);
        serialCom.printTask("PH", "READ", phReading, phSetpoint);
        delay(20);
        serialCom.printTask("PH", "KALMAN", phKalman);
        delay(20);
        serialCom.printTask("LVL", "READ", measureDistance->takeMeasure());
    }

    int going = phControl.doControl();
    if (going != GOING_NONE) {
        serialCom.printTask(
            "PH",
            "CONTROL",
            DROP_TIME,
            0,
            phControl.getControlText(going)
        );
    }
}
