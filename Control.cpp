#include "Control.h"
#include <Arduino_JSON.h>
#include <Arduino.h> //needed for Serial.println

Control::Control(const char* WHOAMI){
    this->WHOAMI = WHOAMI;
}

void Control::calculateError(){
    this->error = abs(this->setPoint - this->current);     
}

void Control::setReadSetPointFromCMD(bool readSetPointFromCMD){
    this->readSetPointFromCMD = readSetPointFromCMD;
}

bool Control::getReadSetPointFromCMD(){
    return this->readSetPointFromCMD;
}

float Control::getSetPoint(){    
    if(!this->readSetPointFromCMD)
        this->setPoint = map(analogRead(POT_PIN), 0, 1023, 50, 70) / 10.0;
    return this->setPoint;
}

void Control::setSetPoint(float setPoint){
    this->setPoint = setPoint;
}
/*
void Control::stabilizationState(){
}

void Control::stabilizationMarginState(){
  
    if (this.error > 0 && this.pH != 0) {
        pH_down(DROP_TIME);
    } else if( this.pH != 0) {   
        pH_up(DROP_TIME);
    }

    long start = millis();
    while (millis() - start < STABILIZATION_TIME) {          
        get_measure_error_and_show();
        print_measure_and_setpoint();
        check_for_command();     
        delay(100);     

        
    }
}
void Control::doControl(){
    
    if (!this->manualMode) {

        if (abs(error) >= ERR_MARGIN && pH != 0) {
           if(abs(error) <= STABILIZATION_MARGIN){

           }
        }
    }
}
*/
void Control::setManualMode(bool manualMode){
  this->manualMode = manualMode;
}
void Control::down(int dropTime) {

    //serialCom.printTask("READ",this->ph, this->desiredPh,"DOWN", true)   
    analogWrite(M_UP, ZERO_SPEED);
    analogWrite(M_DN, M_DN_SPEED);
    delay(dropTime);
    analogWrite(M_DN, ZERO_SPEED);
}

void Control::up(int dropTime) {
    
    //serialCom.printTask("READ",this->ph, this->desiredPh, "UP", true)
    analogWrite(M_DN, ZERO_SPEED);
    analogWrite(M_UP, M_UP_SPEED);
    delay(dropTime);
    analogWrite(M_UP, ZERO_SPEED);
}
