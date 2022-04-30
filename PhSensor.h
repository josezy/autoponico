#ifndef PH_SENSOR_H
#define PH_SENSOR_H

#define PH_RX 10
#define PH_TX 11

#include <Arduino.h> 


class PhSensor {
  
    String sensorString;
    bool sensorStringComplete = false;
    float pH;

    public:  
        void init(int baudrate = 9600);
        float getPh();	

};
#endif
