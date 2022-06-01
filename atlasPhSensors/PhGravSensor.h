#ifndef PH_GRAV_SENSOR_H
#define PH_GRAV_SENSOR_H

#include "ph_grav.h"

class PhGravSensor
{
    Gravity_pH *pH;

public:
    PhGravSensor(int phAnalogPin);
    float getPh();
    bool init();
};
#endif
