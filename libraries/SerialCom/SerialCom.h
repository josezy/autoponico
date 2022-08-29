

#ifndef SERIAL_COM_H
#define SERIAL_COM_H

#define MINUTE 1000L * 60
#define SERIAL_WRITE_TIME 1 * MINUTE

#include "Control.h"
#include "DisplaysTM1637.h"
#include "SensorEEPROM.h"

class SerialCom {
    SensorEEPROM* sensorEEPROM;
    Control* control;

    int baudrate;

    public:
        SerialCom(
            SensorEEPROM* sensorEEPROM,
            Control* control,
            int baudrate = 9600
        );
        void init();
        void printTask(
            const char* whoami,
            const char* task,
            float value,
            float desiredValue = 0.0,
            const char* going = "NA"
        );
        void checkForCommand();
};

#endif
