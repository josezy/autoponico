#ifndef PH_SERIAL_SENSOR_H
#define PH_SERIAL_SENSOR_H

#define PH_RX 10
#define PH_TX 11

#include <Arduino.h> 
#include <SoftwareSerial.h>


class PhSerialSensor {
    
    
    SoftwareSerial* sensorSerial;
    //SERIAL
    String sensorString;
    bool sensorStringComplete = false;
    float pH;

    public:  
        PhSerialSensor(int phTx, int phRx);
        void init(int baudrate = 9600);
        float getPh();	

};
#endif
