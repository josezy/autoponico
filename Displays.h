#ifndef DISPLAYS_H
#define DISPLAYS_H

#define CURRENT_CLOCK 2
#define CURRENT_DIO 3
#define DESIRED_CLOCK 4
#define DESIRED_DIO 5

#include <Arduino.h> //needed for Serial.println
class Displays{
    public:  
        void initDisplays();
        
        void display(int num, String type="sense");

};
#endif
