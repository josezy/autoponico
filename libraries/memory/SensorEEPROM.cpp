
#include "SensorEEPROM.h"
#include <EEPROM.h>
#include <Arduino.h> //needed for Serial.println

//pH 5.0 => 9.0
//pHeeprom  0 => 255
#define MAX_DESIRED_PH 8.0
#define MIN_DESIRED_PH 5.0
#define DESIRED_PH_ADDRESS 0
#define DESIRED_PH_FLAG_ADDRESS 1


#define MAX_DESIRED_EC 8.0
#define MIN_DESIRED_EC 5.0
#define DESIRED_EC_ADDRESS 10
#define DESIRED_EC_FLAG_ADDRESS 1

SensorEEPROM::SensorEEPROM(const char* WHOAMI){
    this->WHOAMI = WHOAMI;
}

bool SensorEEPROM::readFromCmd(){
    return EEPROM.read(DESIRED_PH_FLAG_ADDRESS)==1;    
}

float SensorEEPROM::getPh(){    
    return(map(EEPROM.read(DESIRED_PH_ADDRESS), 0, 255, MIN_DESIRED_PH*10, MAX_DESIRED_PH*10)/10.0);
}

void SensorEEPROM::desiredPhToEEPROM(float cmdPh) {
    EEPROM.write(DESIRED_PH_ADDRESS, map((int)(cmdPh*10), MIN_DESIRED_PH*10, MAX_DESIRED_PH*10, 0, 255));
}
