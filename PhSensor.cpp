#include "PhSensor.h"
#include <SoftwareSerial.h>


PhSensor::PhSensor(int phTx, int phRx){
    this->sensorSerial  = new SoftwareSerial(phTx,phRx);
}

void PhSensor::init(int baudrate){
    this->sensorSerial->begin(baudrate);
}

float PhSensor::getPh(){
    if (this->sensorSerial->available() > 0) {
        char inchar = (char) this->sensorSerial->read();
        this->sensorString += inchar;

        if (inchar == '\r') {
            this->pH = this->sensorString.toFloat();
            this->sensorString = "";
        }
    }
    return this->pH;
}
