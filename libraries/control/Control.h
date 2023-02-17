#ifndef CONTROL_H
#define CONTROL_H

#define GOING_UP 1
#define GOING_DOWN 0
#define GOING_NONE -1
//Control states
#define STABILIZING 2
#define CONTROLING 1
#define STABLE 0

#include <stdint.h> 
struct ControlConfig {    
    //Pin configurations
    const uint16_t POT_PIN;
    const uint16_t M_UP;
    const uint16_t M_DN;
    //Param configurations
    const uint32_t M_UP_SPEED;
    const uint32_t M_DN_SPEED;
    const uint32_t ZERO_SPEED;
    const uint32_t DROP_TIME;
    //Control param configurations    
    const float ERR_MARGIN;
    const long int STABILIZATION_TIME;
    const float STABILIZATION_MARGIN;
    //Set point max min.    
    const float MAX_DESIRED_MEASURE;
    const float MIN_DESIRED_MEASURE;    

};

class Control {

    ControlConfig* configuration;
    bool manualMode=false;
    int state = STABLE;    
    float error;    
    float current = 0;
    float setPoint;
    bool readSetPointFromCMD = false;    
    float stabilizationTimer;
    
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
