
#include "Control.h"
#include "Displays74HC595.h"
#include "SensorEEPROM.h"
#include "SerialCom.h"
#include "PhGravSensor.h"
#include <SimpleKalmanFilter.h>

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
Control control = Control(&configuration);

#define CURRENT_SEG7_DATA 2
#define CURRENT_SEG7_CLOCK 3
#define CURRENT_SEG7_LATCH 4
#define DESIRED_SEG7_DATA 5
#define DESIRED_SEG7_CLOCK 6
#define DESIRED_SEG7_LATCH 7

Displays74HC595 displays = Displays74HC595(
    CURRENT_SEG7_DATA, CURRENT_SEG7_CLOCK, CURRENT_SEG7_LATCH,
    DESIRED_SEG7_DATA, DESIRED_SEG7_CLOCK, DESIRED_SEG7_LATCH);

#define PH_ANALOG_PIN A0
PhGravSensor phSensor = PhGravSensor(PH_ANALOG_PIN);

SerialCom serialCom = SerialCom(WHOAMI, &sensorEEPROM, &control, 1 * MINUTE);

#define MEASUREMENT_UNCERTAINTY 1
#define ESTIMATION_UNCERTAINTY 1
#define PROCESS_NOISE 0.01
SimpleKalmanFilter pressureKalmanFilter(MEASUREMENT_UNCERTAINTY, ESTIMATION_UNCERTAINTY, PROCESS_NOISE);


void setup()
{

    serialCom.init();
    if (phSensor.init())
    {
        serialCom.print("EEPROM LOADED");
    }

    control.setManualMode(true);
    control.setSetPoint(sensorEEPROM.getPh());
    control.setReadSetPointFromCMD(sensorEEPROM.readFromCmd());
}

void loop()
{
    float stimatedMeasure = pressureKalmanFilter.updateEstimate(phSensor.getPh());
    control.setCurrent(stimatedMeasure);
    serialCom.printTask("READ", control.getCurrent(), control.getSetPoint());

    control.calculateError();

    displays.display(control.getCurrent());
    displays.display(control.getSetPoint(), "asd");
    serialCom.checkForCommand();

    int going = control.doControl();
    if (going != GOING_NONE)
        serialCom.printTask(
            "CONTROL",
            phSensor.getPh(),
            control.getSetPoint(),
            0,
            control.getControlText(going),
            true);
}
