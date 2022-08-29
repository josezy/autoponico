#ifndef ATLAS_SERIAL_SENSOR_H
#define ATLAS_SERIAL_SENSOR_H

#include <Arduino.h>
#include <SoftwareSerial.h>

class AtlasSerialSensor {
    SoftwareSerial *sensorSerial;
    String sensorString = "";
    float lastReading;

    public:
        AtlasSerialSensor(int Rx, int Tx, int baudrate = 9600);
        float getReading();
};

#endif
