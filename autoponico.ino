
#include "Control.h"
#include "Displays.h"
#include "PhSensor.h"
#include "SensorEEPROM.h"
#include "SerialCom.h"


#define WHOAMI "PH"

SensorEEPROM sensorEEPROM = SensorEEPROM(WHOAMI);
Control control = Control(WHOAMI);
Displays displays = Displays();
PhSensor phSensor = PhSensor();
SerialCom serialCom = SerialCom(WHOAMI, &sensorEEPROM, &control, &phSensor);


void setup() {
    displays.initDisplays();
    phSensor.init();
    serialCom.init();
    control.setSetPoint(sensorEEPROM.getPh());
    control.setReadSetPointFromCMD(sensorEEPROM.readFromCmd());
  
}


void loop() {
   
    get_measure_error_and_show();
  
    delay(SLEEPING_TIME);
}

void get_measure_error_and_show(){
    displays.display(phSensor.getPh()*10);
    displays.display(control.getSetPoint()*10,"asd");     
    serialCom.checkForCommand();
    control.calculateError();
}
