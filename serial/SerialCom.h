

#ifndef SERIAL_COM_H
#define SERIAL_COM_H

#define MINUTE 1000L * 60
#define SERIAL_WRITE_TIME 1 * MINUTE


#include "Control.h"
#include "DisplaysTM1637.h"
#include "SensorEEPROM.h"
class SerialCom {
    const char* WHOAMI;
    float serialWriteTimer;
    float millisBetweenPrint = SERIAL_WRITE_TIME;
    
    SensorEEPROM* sensorEEPROM;
    Control* control;
    public:  
        SerialCom(
            const char* WHOAMI, 
            SensorEEPROM* sensorEEPROM, 
            Control* control,
            float millisBetweenPrint = SERIAL_WRITE_TIME
        );
        void init(int baudrate = 9600);
        void printTask(const char* task, float value, float desiredValue, const char* going ="NA", bool now = false);	
        void checkForCommand();

};
#endif
