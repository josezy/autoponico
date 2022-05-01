#include "PhGravSensor.h"

#include "atlas_gravity/ph_grav.h"     
PhGravSensor::PhGravSensor(int phAnalogPin)
{
    this->pH = new Gravity_pH(A0);
}

float PhGravSensor::getPh()
{
    return this->pH->read_ph();
}
