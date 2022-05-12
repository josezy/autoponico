
#include "Control.h"
#include "Displays74HC595.h"
#include "SensorEEPROM.h"
#include "SerialCom.h"
#include "PhSerialSensor.h"

#define WHOAMI "PH"
SensorEEPROM sensorEEPROM = SensorEEPROM(WHOAMI);

#define MINUTE 1000L * 60
#define POT_PIN A0
#define M_UP 8
#define M_DN 9
#define M_UP_SPEED 200
#define M_DN_SPEED 200
#define ZERO_SPEED 0
#define STABILIZATION_MARGIN 0.1
#define ERR_MARGIN 0.3
#define STABILIZATION_TIME 1 * MINUTE
#define DROP_TIME 1000

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
  STABILIZATION_MARGIN
};
Control control = Control(&configuration);

#define CURRENT_SEG7_DATA 2
#define CURRENT_SEG7_CLOCK 3
#define CURRENT_SEG7_LATCH 4
#define DESIRED_SEG7_DATA 5
#define DESIRED_SEG7_CLOCK 6
#define DESIRED_SEG7_LATCH 7

Displays74HC595 displays =  Displays74HC595(
    CURRENT_SEG7_DATA, CURRENT_SEG7_CLOCK, CURRENT_SEG7_LATCH,
    DESIRED_SEG7_DATA, DESIRED_SEG7_CLOCK, DESIRED_SEG7_LATCH
);    

#define PH_RX 10
#define PH_TX 11
PhSerialSensor phSensor = PhSerialSensor(PH_TX,PH_RX);

SerialCom serialCom = SerialCom(WHOAMI, &sensorEEPROM, &control);


void setup() {
    phSensor.init();
    serialCom.init();
    control.setSetPoint(sensorEEPROM.getPh());
    control.setReadSetPointFromCMD(sensorEEPROM.readFromCmd());  
}

void loop() {   
    serialCom.printTask("READ", phSensor.getPh(),control.getCurrent());

    control.setCurrent(phSensor.getPh());
    control.calculateError();
    
    displays.display(control.getCurrent());
    displays.display(control.getSetPoint(),"asd");   
    serialCom.checkForCommand();

    int going = control.doControl();
    if(going != GOING_NONE)
        serialCom.printTask(
            "CONTROL",
            phSensor.getPh(),
            control.getCurrent(),
            control.getControlText(going),
            true
        );
    
    delay(1000);
}
