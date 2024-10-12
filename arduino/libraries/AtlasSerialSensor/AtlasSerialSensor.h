#ifndef ATLAS_SERIAL_SENSOR_H
#define ATLAS_SERIAL_SENSOR_H

#include <Arduino.h>
#include <HardwareSerial.h>

class AtlasSerialSensor {
    HardwareSerial* ezoSerial;
    String sensorString = "";
    bool sensorStringComplete = false;
    float lastReading = 0;
    int rx;
    int tx;

    public:
        AtlasSerialSensor(HardwareSerial& serial, int rx, int tx);
        void begin(int baudrate = 9600);
        void sendSerial(String command);
        void readSerial();
        float getReading();
        String sensorStringToWebsocket = "";
};

#endif
