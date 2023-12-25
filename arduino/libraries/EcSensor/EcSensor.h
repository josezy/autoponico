#ifndef EC_SENSOR_H
#define EC_SENSOR_H

#include <OneWire.h>
#include <DallasTemperature.h>

#define PPM_FACTOR 0.5 // Hana      [USA]
#define TEMP_COEF 0.019
#define MILLIS_BETWEEN_READ 5000

struct ECSensorConfig {    
    
    //Electrode pins
    const int EC_PIN;    
    const int EC_GND;    
    const int EC_POWER;  
    //Temp probe pins
    const int ONE_WIRE_PIN; 
    const int TEMP_PROBE_POSSITIVE;  
    const int TEMP_PROBE_NEGATIVE;
    //Params
    const float K;
   
    
};
class EcSensor {    
    OneWire* oneWire;      
    DallasTemperature* sensors;
    ECSensorConfig* configuration;
    //Measures
    float Temperature = 10;
    float EC = 0;
    float EC25 = 0;
    int ppm = 0;
    int desiredPPM = 0;
    //Circuit constants
    int R1 = 1000;
    int Ra = 25; //Resistance of powering Pins
    float Rc = 0;
    float Vin = 5;
    float Vdrop = 0;
    //Raw data
    float raw = 0;
    float buffer = 0;

    float measureTimer;

    public:  
        EcSensor(ECSensorConfig*);
        void init();
        float getEc();	
        float getTemperature();

};
#endif
