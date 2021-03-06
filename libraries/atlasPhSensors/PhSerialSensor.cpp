#include "PhSerialSensor.h"
#include <SoftwareSerial.h>


PhSerialSensor::PhSerialSensor(int phRx, int phTx){
    this->sensorSerial  = new SoftwareSerial(phRx, phTx);
}

void PhSerialSensor::init(int baudrate){
    this->sensorSerial->begin(baudrate);
}

float PhSerialSensor::getPh(){
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
