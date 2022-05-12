#ifndef CONTROL_H
#define CONTROL_H

#define GOING_UP 1
#define GOING_DOWN 0
#define GOING_NONE -1

#define STABILIZING 2
#define CONTROLING 1
#define STABLE 0
#include <stdint.h> 
struct ControlConfig {    
    
    unsigned int POT_PIN;    
    int M_UP;
    int M_DN;

    int M_UP_SPEED;
    int M_DN_SPEED;
    int ZERO_SPEED;
    int DROP_TIME;
    
    float ERR_MARGIN;
    long int STABILIZATION_TIME;
    float STABILIZATION_MARGIN;
    
};


class Control {

    ControlConfig* configuration;
    bool manualMode=false;

    float total = 0;
    float counter = 0;
    const uint8_t samples = 1;

    int state = STABLE;    
    float error;    
    float current = 0;
    float setPoint;
    bool readSetPointFromCMD = false;

    
    float stabilizationTimer;

    float value;
    
    public:  
        Control(ControlConfig* configuration);
        void up(int dropTime);	
        void down(int dropTime);	
        int doControl();
        const char* getControlText(int control_type);
        void setManualMode(bool manualMode);

        void setCurrent(float current);
        float getCurrent();

        void setSetPoint(float setPoint);
        float getSetPoint();

        void setReadSetPointFromCMD(bool readSetPointFromCMD);
        bool getReadSetPointFromCMD();


        void calculateError();

};
#endif
