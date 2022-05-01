#ifndef PH_GRAV_SENSOR_H
#define PH_GRAV_SENSOR_H


#include "atlas_gravity/ph_grav.h"       

class PhGravSensor {    
    Gravity_pH* pH;   
    public:  
        PhGravSensor(int phAnalogPin);
        bool init();
        float getPh();	

};
#endif
