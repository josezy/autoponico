
#include "Control.h"
#include "SerialCom.h"
#include "PhGravSensor.h"
#include "SensorEEPROM.h"

#define WHOAMI "PH"
SensorEEPROM sensorEEPROM = SensorEEPROM(WHOAMI);

#define WHOAMI "PH"
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

#define PH_ANALOG A0
PhGravSensor phSensor = PhGravSensor(PH_ANALOG);

SerialCom serialCom = SerialCom(WHOAMI, &sensorEEPROM, &control, 5000 );


void setup() {
    serialCom.init();
    control.setSetPoint(sensorEEPROM.getPh());
    control.setReadSetPointFromCMD(sensorEEPROM.readFromCmd());  
}

void loop() {   
    serialCom.printTask("READ", control.getCurrent(), control.getSetPoint());
    control.setCurrent(phSensor.getPh());
    serialCom.checkForCommand();
    
}
