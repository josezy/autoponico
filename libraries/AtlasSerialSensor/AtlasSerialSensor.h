#ifndef ATLAS_SERIAL_SENSOR_H
#define ATLAS_SERIAL_SENSOR_H

#include <Arduino.h>
#include <SoftwareSerial.h>
#define A 0.02

class AtlasSerialSensor {
    SoftwareSerial *sensorSerial;
    String sensorString = "";
    float lastReading;

    public:
        AtlasSerialSensor(int Rx, int Tx, int baudrate = 9600);
        float getReading();
        float getCompensateReading(float temp);
        float setTemperature(float temp);
};

#endif
