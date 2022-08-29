
#include "Control.h"
#include "Displays74HC595.h"
#include "AtlasSerialSensor.h"
#include "SensorEEPROM.h"
#include "SerialCom.h"
#include "ph_grav.h"

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
#define DESIRED_SEG7_DATA 5
#define DESIRED_SEG7_CLOCK 6
#define DESIRED_SEG7_LATCH 7

Displays74HC595 displays = Displays74HC595(
    CURRENT_SEG7_DATA, CURRENT_SEG7_CLOCK, CURRENT_SEG7_LATCH,
    DESIRED_SEG7_DATA, DESIRED_SEG7_CLOCK, DESIRED_SEG7_LATCH);

#define EC_RX 10
#define EC_TX 11
AtlasSerialSensor ecSensor = AtlasSerialSensor(EC_RX, EC_TX);

#define GRAV_PH_PIN A0
Gravity_pH phSensor = Gravity_pH(GRAV_PH_PIN);

SerialCom serialCom = SerialCom(&sensorEEPROM, &phControl);

unsigned long lastMillis;
unsigned int SERIAL_PERIOD = 1 * MINUTE;

void setup() {
    phSensor.begin();
    serialCom.init();
    phControl.setManualMode(false);
    phControl.setSetPoint(sensorEEPROM.getPh());
    phControl.setReadSetPointFromCMD(sensorEEPROM.readFromCmd());
    lastMillis = millis();
}

void loop() {
    float ecReading = ecSensor.getReading();

    float phReading = phSensor.read_ph();
    phControl.setCurrent(phReading);

    float phSetpoint = phControl.getSetPoint();
    phControl.calculateError();

    displays.display(phReading);
    displays.display(phSetpoint, "asd");
    serialCom.checkForCommand();

    if ((millis() - lastMillis) > SERIAL_PERIOD) {
        lastMillis = millis();
        serialCom.printTask("EC", "READ", ecReading);
        serialCom.printTask("PH", "READ", phReading, phSetpoint);
    }

    int going = phControl.doControl();
    if (going != GOING_NONE) {
        serialCom.printTask(
            "PH",
            "CONTROL",
            phReading,
            phSetpoint,
            phControl.getControlText(going)
        );
    }
}
