
#include "Control.h"
#include "DisplaysTM1637.h"
#include "SensorEEPROM.h"
#include "SerialCom.h"


#define CURRENT_CLOCK 2
#define CURRENT_DIO 3
#define DESIRED_CLOCK 4
#define DESIRED_DIO 5

DisplaysTM1637 displays = DisplaysTM1637(
    CURRENT_CLOCK,
    CURRENT_DIO,
    DESIRED_CLOCK,
    DESIRED_DIO
);


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
