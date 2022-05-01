#include "Control.h"
#include <Arduino_JSON.h>
#include <Arduino.h> //needed for Serial.println

Control::Control(ControlConfig* configuration){
    this->configuration = configuration;
}

void Control::calculateError(){
    this->error =  this->current- this->setPoint;     
}

void Control::setReadSetPointFromCMD(bool readSetPointFromCMD){
    this->readSetPointFromCMD = readSetPointFromCMD;
}

bool Control::getReadSetPointFromCMD(){
    return this->readSetPointFromCMD;
}

float Control::getSetPoint(){    
    if(!this->readSetPointFromCMD)
        this->setPoint = map(analogRead(this->configuration->POT_PIN), 0, 1023, 50, 70) / 10.0;
    return this->setPoint;
}

void Control::setSetPoint(float setPoint){
    this->setPoint = setPoint;
}

float Control::getCurrent(){
    return this->current;
}

void Control::setCurrent(float current){
    this->current = current;
}

void Control::doControl(){
    if(millis() - this->stabilizationTimer < this->configuration->STABILIZATION_TIME ||
        !this->stabilizationTimer){
        if (!this->manualMode) {

            if (abs(this->error) >= this->configuration->ERR_MARGIN && this->current != 0) {
                if(abs(this->error) <= this->configuration->STABILIZATION_MARGIN){
                    if (this->error > 0 && this->current != 0) {
                        this->down(this->configuration->DROP_TIME);
                    } else if( this->error < 0 && this->current != 0) {   
                        this->up(this->configuration->DROP_TIME);
                    }
                    this->stabilizationTimer = millis();

                }
            }
        }

    }
   
}


void Control::setManualMode(bool manualMode){
  this->manualMode = manualMode;
}
void Control::down(int dropTime) {

    //serialCom.printTask("READ",this->ph, this->desiredPh,"DOWN", true)   
    analogWrite(this->configuration->M_UP, this->configuration->ZERO_SPEED);
    analogWrite(this->configuration->M_DN, this->configuration->M_DN_SPEED);
    delay(dropTime);
    analogWrite(this->configuration->M_DN, this->configuration->ZERO_SPEED);
}

void Control::up(int dropTime) {
    
    //serialCom.printTask("READ",this->ph, this->desiredPh, "UP", true)
    analogWrite(this->configuration->M_DN, this->configuration->ZERO_SPEED);
    analogWrite(this->configuration->M_UP, this->configuration->M_UP_SPEED);
    delay(dropTime);
    analogWrite(this->configuration->M_UP, this->configuration->ZERO_SPEED);
}
