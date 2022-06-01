#include "PhGravSensor.h"

#include "ph_grav.h"
PhGravSensor::PhGravSensor(const int phAnalogPin)
{
    this->pH = new Gravity_pH(phAnalogPin);
}
bool PhGravSensor::init()
{
    return this->pH->begin();
}
float PhGravSensor::getPh()
{
    return this->pH->read_ph();
}
