
#include "Control.h"
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
    A1,          // POT_PIN
    8,           // M_UP
    9,           // M_DN,
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
Control phControl = Control(&configuration);

#define MINUTE 1000L * 60

ControlConfig ecUpConfiguration = {
    0,           // POT_PIN
    2,           // M_UP
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

#define TANK_LVL_CM 50
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
    phControl.setReadSetPointFromCMD(true);

    ecUpControl.setManualMode(false);
    ecUpControl.setSetPoint(2000);
    ecUpControl.setReadSetPointFromCMD(true);

    lastMillis = millis();
    pinMode(13, OUTPUT);
    digitalWrite(13, HIGH);
    serialCom.printTask("PH", "START", 1);
    serialCom.printTask("EC", "START", 1);
}

void loop() {

    float ecReading = ecSensor.getReading();
    float ecKalman = simpleKalmanFilter.updateEstimate(ecReading);
    ecUpControl.setCurrent(ecKalman);
    // float ecSetpoint = ecUpControl.getSetPoint();
    ecUpControl.calculateError();

    float phReading = phSensor.read_ph();
    float phKalman = simpleKalmanFilter.updateEstimate(phReading);

    phControl.setCurrent(phKalman);
    float phSetpoint = phControl.getSetPoint();    
    phControl.calculateError();

    serialCom.checkForCommand();
    
    if ((millis() - lastMillis) > SERIAL_PERIOD) {
        lastMillis = millis();
        serialCom.printTask("EC", "READ", ecReading);
        delay(20);
        serialCom.printTask("PH", "READ", phReading, phSetpoint);
        delay(20);
        serialCom.printTask("PH", "KALMAN", phKalman);
        delay(20);
        serialCom.printTask("LVL", "READ", TANK_LVL_CM-measureDistance->takeMeasure());
    }

    int going = phControl.doControl();
    if (going != GOING_NONE) {
        serialCom.printTask(
            "PH",
            "CONTROL",
            1000,
            0,
            phControl.getControlText(going)
        );
    }

    int goingEc = ecUpControl.doControl();
    if (goingEc != GOING_NONE)
    {
        serialCom.printTask(
            "EC",
            "CONTROL",
            10000,
            0,
            ecUpControl.getControlText(goingEc));
    }
    
}
