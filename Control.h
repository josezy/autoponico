#ifndef PH_CONTROL_H
#define PH_CONTROL_H

#include <Arduino.h> //needed for Serial.println
#include "PhSensor.h"


#define PH_RX 10
#define PH_TX 11

#define POT_PIN A0

#define M_UP 8
#define M_DN 9
#define M_UP_SPEED 200
#define M_DN_SPEED 200
#define ZERO_SPEED 0

// Controller constants
#define ERR_MARGIN 0.3
#define STABILIZATION_MARGIN 0.1

#define MINUTE 1000L * 60
#define STABILIZATION_TIME 1 * MINUTE

#define SLEEPING_TIME 1000
#define SERIAL_WRITE_TIME 1 * MINUTE


class Control {
    const char* WHOAMI;
    bool manualMode=false;

    float total = 0;
    float current = 0;
    float counter = 0;
    const uint8_t samples = 1;

    float error;    
    float setPoint;
    bool readSetPointFromCMD = false;

    float value;

    
    public:  
        Control(const char* WHOAMI);
        void up(int dropTime);	
        void down(int dropTime);	
        void doControl();
        void setManualMode(bool manualMode);
        void setSetPoint(float setPoint);
        float getSetPoint();

        void setReadSetPointFromCMD(bool readSetPointFromCMD);
        bool getReadSetPointFromCMD();


        void calculateError();

};
#endif
