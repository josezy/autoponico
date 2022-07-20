

#ifndef SENSOR_EEPROM_H
#define SENSOR_EEPROM_H

class SensorEEPROM{
    const char* WHOAMI;
   
    public:  
        SensorEEPROM(const char* WHOAMI);
        bool readFromCmd();
        float getPh();	
        void desiredPhToEEPROM(float cmdPh);

};
#endif
