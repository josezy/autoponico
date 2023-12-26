#ifndef ATLAS_SERIAL_SENSOR_H
#define ATLAS_SERIAL_SENSOR_H

#include <Arduino.h>
#include <SoftwareSerial.h>

class AtlasSerialSensor {
    SoftwareSerial *sensorSerial;
    String sensorString = "";
    String lastReading;
    boolean sensorStringComplete = false;

    public:
        AtlasSerialSensor(int rx, int tx);
        float getReading();
        void begin(int baudrate = 9600);
        void readSerial();
};


#endif
