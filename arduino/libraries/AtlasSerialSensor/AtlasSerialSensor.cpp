#include "AtlasSerialSensor.h"

AtlasSerialSensor::AtlasSerialSensor(HardwareSerial& serial) : ezoSerial(&serial) {
    this->sensorString.reserve(30);
}

void AtlasSerialSensor::readSerial() {
    if (this->ezoSerial->available() > 0) {
        char inchar = (char)this->ezoSerial->read();
        this->sensorString += inchar;
        if (inchar == '\r') {
            this->sensorStringComplete = true;
        }
    }
    if (this->sensorStringComplete) {
        String sensorStringCopy = this->sensorString;
        this->sensorString = "";
        this->sensorStringComplete = false;

        if (isDigit(sensorStringCopy[0])) {
            char sensorstring_array[30];
            sensorStringCopy.toCharArray(sensorstring_array, 30);
            char* EC = strtok(sensorstring_array, ",");
            this->lastReading = String(EC).toFloat();
        }

        // To send through websocket
        this->sensorStringToWebsocket = sensorStringCopy;    
    }
}

float AtlasSerialSensor::getReading() {
    this->sendSerial("R");
    
    // Wait for serial to respond AT command: 143.5,12\r*OK\r
    int cr_received = 0;
    int timeout = 0;
    String atString = "";
    while (cr_received < 2 && timeout < 1000) {
        delay(1);
        timeout++;
        if (this->ezoSerial->available() > 0) {
            char inchar = (char)this->ezoSerial->read();
            atString += inchar;
            if (inchar == '\r') {
                cr_received++;
            }
        }
    }
    if (timeout >= 1000) {
        return 0;
    }

    int cr_index = atString.indexOf('\r');
    if (cr_index < 0) {
        return 0;
    }

    String ec_data = atString.substring(0, cr_index);
    char* EC = strtok((char*)ec_data.c_str(), ",");
    this->lastReading = String(EC).toFloat();
    return this->lastReading;
}

void AtlasSerialSensor::sendSerial(String command) {
    this->ezoSerial->print(command);
    this->ezoSerial->print('\r');
}

void AtlasSerialSensor::begin(int baudrate) {
    this->ezoSerial->begin(baudrate);
}
