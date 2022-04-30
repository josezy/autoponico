#include "PhSensor.h"
#include "SensorEEPROM.h"
#include <SoftwareSerial.h>

SoftwareSerial sensorSerial(PH_RX, PH_TX);

void PhSensor::init(int baudrate){
    sensorSerial.begin(baudrate);
}

float PhSensor::getPh(){
    if (sensorSerial.available() > 0) {
        char inchar = (char)sensorSerial.read();
        this->sensorString += inchar;

        if (inchar == '\r') {
            this->pH = this->sensorString.toFloat();
            this->sensorString = "";
        }
    }

    return this->pH;
}
