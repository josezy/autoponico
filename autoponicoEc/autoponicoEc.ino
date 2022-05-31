
#include "Control.h"
#include "DisplaysTM1637.h"
#include "SensorEEPROM.h"
#include "SerialCom.h"
#include "EcSensor.h"

#define WHOAMI "EC"
SensorEEPROM sensorEEPROM = SensorEEPROM(WHOAMI);

#define MINUTE 1000L * 60
#define POT_PIN A2
#define M_UP 11
#define M_DN -1
#define M_UP_SPEED 200
#define M_DN_SPEED -1
#define ZERO_SPEED 0
#define STABILIZATION_MARGIN 0.1
#define ERR_MARGIN 0.3
#define STABILIZATION_TIME 10 * MINUTE
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

#define CURRENT_CLK 2
#define CURRENT_DIO 3
#define DESIRED_CLK 4
#define DESIRED_DIO 5

DisplaysTM1637 displays =  DisplaysTM1637(
    CURRENT_CLK, CURRENT_DIO, 
    DESIRED_CLK, DESIRED_DIO 
);    

#define EC_PIN A0
#define EC_GND A1
#define EC_POWER A4

#define ONE_WIRE_PIN 10
#define TEMP_PROBE_POSSITIVE 8
#define TEMP_PROBE_NEGATIVE 9

#define K 2.8 
ECSensorConfig sensorConfiguration = {
   //Electrode pins
    EC_PIN,    
    EC_GND,    
    EC_POWER,  
    //Temp probe pins
    ONE_WIRE_PIN, 
    TEMP_PROBE_POSSITIVE,  
    TEMP_PROBE_NEGATIVE,
    //Params
    K
};

EcSensor ecSensor = EcSensor(&sensorConfiguration);

SerialCom serialCom = SerialCom(WHOAMI, &sensorEEPROM, &control, 1 * MINUTE );


void setup() {
    serialCom.init();
    control.setManualMode(false);
    control.setReadSetPointFromCMD(false);  
}

void loop() {   
    
    control.setCurrent(ecSensor.getEc());
    serialCom.printTask("READ", control.getCurrent(), control.getSetPoint());

    control.calculateError();
    
    displays.display(control.getCurrent());
    displays.display(control.getSetPoint(),"asd");   
    serialCom.checkForCommand();

    int going = control.doControl();
    if(going != GOING_NONE)
        serialCom.printTask(
            "CONTROL",
            control.getCurrent(),
            control.getSetPoint(),
            control.getControlText(going),
            true
        );
    
}
