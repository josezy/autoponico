

#ifndef SERIAL_COM_H
#define SERIAL_COM_H

#define MINUTE 1000L * 60
#define SERIAL_WRITE_TIME 1 * MINUTE

#include "Control.h"
#include "PhSensor.h"
#include "SensorEEPROM.h"
class SerialCom {
    const char* WHOAMI;
    float serialWriteTimer;
    
    SensorEEPROM* sensorEEPROM;
    Control* phControl;
    PhSensor* phSensor;
    public:  
        SerialCom(const char* WHOAMI, SensorEEPROM* sensorEEPROM, Control* phControl, PhSensor* phSensor);
        void init(int baudrate = 9600);
        void printTask(char* task, float value, float desiredValue, const char* going ="NA", bool now = false);	
        void checkForCommand();

};
#endif
