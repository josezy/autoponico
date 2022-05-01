#ifndef PH_SENSOR_H
#define PH_SENSOR_H

#define PH_RX 10
#define PH_TX 11

#include <Arduino.h> 
#include <SoftwareSerial.h>


class PhSensor {
    
    
    SoftwareSerial* sensorSerial;
    //SERIAL
    String sensorString;
    bool sensorStringComplete = false;
    float pH;

    public:  
        PhSensor(int phTx, int phRx);
        void init(int baudrate = 9600);
        float getPh();	

};
#endif
