#include "AtlasSerialSensor.h"

#include <SoftwareSerial.h>

AtlasSerialSensor::AtlasSerialSensor(int rx, int tx)
{
    this->sensorSerial = new SoftwareSerial(rx, tx);
    this->sensorString.reserve(30);
}

void AtlasSerialSensor::readSerial()
{
    if (this->sensorSerial->available() > 0)
    {                                                   // if we see that the Atlas Scientific product has sent a character
        char inchar = (char)this->sensorSerial->read(); // get the char we just received
        this->sensorString += inchar;                   // add the char to the var called this->sensorString
        if (inchar == '\r')
        {                                      // if the incoming character is a <CR>
            this->sensorStringComplete = true; // set the flag
        }
    }

    if (this->sensorStringComplete == true)
    { // if a string from the Atlas Scientific product has been received in its entirety
        if (isdigit(this->sensorString[0]) == false) // FIXME: make sure this actually works, clean up code
        {                                       // if the first character in the string is a digit
            Serial.println(this->sensorString); // send that string to the PC's serial monitor
        }
        else // if the first character in the string is NOT a digit
        {
            char sensorstring_array[30];                            // we make a char array
            this->sensorString.toCharArray(sensorstring_array, 30); // convert the string to a char array
            this->lastReading = strtok(sensorstring_array, ",");    // let's pars the array at each comma
        }
        this->sensorString = "";                  // clear the string
        this->sensorStringComplete = false; // reset the flag used to tell if we have received a completed string from the Atlas Scientific product
    }
}

float AtlasSerialSensor::getReading()
{
    return this->lastReading.toFloat();
}

void AtlasSerialSensor::begin(int baudrate)
{
    this->sensorSerial->begin(baudrate);
}