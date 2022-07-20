#ifndef DISPLAYS_74HC595_H
#define DISPLAYS_74HC595_H

#define NUM_DIGITS 2

#include <ShiftRegister74HC595.h>
#include <Arduino.h> //needed for Serial.println


class Displays74HC595{
    ShiftRegister74HC595<NUM_DIGITS>* currentDisplay;
    ShiftRegister74HC595<NUM_DIGITS>* setPointDisplay;
    public:  
        Displays74HC595(
            uint8_t currentData, uint8_t currentClock, uint8_t currentLatch,
            uint8_t setPointData, uint8_t setPointClock, uint8_t setPointLatch
        );        
        void display(float value, String type="sense");

};
#endif
