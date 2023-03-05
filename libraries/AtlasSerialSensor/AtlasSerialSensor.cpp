#include "AtlasSerialSensor.h"

#include <SoftwareSerial.h>

AtlasSerialSensor::AtlasSerialSensor(int Rx, int Tx, int baudrate) {
    this->sensorSerial = new SoftwareSerial(Rx, Tx);
    this->sensorSerial->begin(baudrate);
}

float AtlasSerialSensor::getCompenseReading(float temp)
{
    // https://www.aqion.de/site/112
    return (1+ A *(temp-25))*this->lastReading;
}

float AtlasSerialSensor::getReading() {
    if (this->sensorSerial->available() > 0) {
        char inchar = (char)this->sensorSerial->read();
        this->sensorString += inchar;

        if (inchar == '\r') {
            this->lastReading = this->sensorString.toFloat();
            this->sensorString = "";
        }
    }
    return this->lastReading;
}
