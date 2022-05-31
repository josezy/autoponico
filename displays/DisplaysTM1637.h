#ifndef DISPLAYS_TM1637_H
#define DISPLAYS_TM1637_H


#include <TM1637.h>
#include <Arduino.h> //needed for Serial.println
class DisplaysTM1637{
    TM1637* currentDisplay;
    TM1637* setPointDisplay;
    public:  
        void init();
        DisplaysTM1637(uint8_t CurrentCLK, uint8_t CurrentDIO, uint8_t setPointCLK, uint8_t setPointDIO);
        
        void display(int num, String type="sense");

};
#endif
