#include "Control.h"
#include <Arduino_JSON.h>
#include <Arduino.h> //needed for Serial.println

Control::Control(ControlConfig* configuration){
    this->samplesArray = new float[this->samples]();
    this->configuration = configuration;
    this->stabilizationTimer = millis();
    this->takeSampleTimer = millis();
    if(configuration->M_UP>0)
        pinMode(configuration->M_UP, OUTPUT);
    if(configuration->M_DN>0)
        pinMode(configuration->M_DN, OUTPUT);
}

const char* Control::getControlText(int control_type){
    switch(control_type){
        case GOING_UP:
            return "UP";
        case GOING_DOWN:
            return "DOWN";
        default:
            return "NONE";
    }

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
        this->setPoint = map(
            analogRead(this->configuration->POT_PIN),
            0, 
            1023, 
            this->configuration->MIN_DESIRED_MEASURE,
            this->configuration->MAX_DESIRED_MEASURE
        ) / 10.0;
    return this->setPoint;
}

void Control::setSetPoint(float setPoint){
    this->setPoint = setPoint;
}

float Control::getCurrent(){
    return this->current;
}

float Control::getMeasureFromSamples(){
    this->current = 0;
    for(int i = 0; i<this->samples ; i++){
        this->current += this->samplesArray[i];
    }
    this->current = this->current/this->samples;
}

float* Control::getSamplesArray(){

  return this->samplesArray;
}

const uint8_t Control::getSamples(){

  return this->samples;
}

void Control::setCurrent(float current){
    if(millis()-this->takeSampleTimer>this->takeSamplePeriod){
        this->takeSampleTimer = millis();
        (*(this->samplesArray+this->samplesIndex)) = current;     
        this->samplesIndex++;
        if(this->samplesIndex>=this->samples)
            this->samplesIndex = 0;
        this->getMeasureFromSamples();   
    }
}

int Control::doControl(){
    int going = GOING_NONE;
    if (!this->manualMode) {

        switch(this->state){
            case STABLE:
                if (
                    abs(this->error) >= this->configuration->ERR_MARGIN && 
                    this->current != 0
                ) {
                    this->state = CONTROLING;
                }
                break;
            case CONTROLING:
                if(
                    abs(this->error) >= this->configuration->STABILIZATION_MARGIN
                ){
                    if (this->error > 0 && this->current != 0 && this->configuration->M_DN>0) {
                        this->down(this->configuration->DROP_TIME);
                        going = GOING_DOWN;
                    } else if( this->error < 0 && this->current != 0 && this->configuration->M_UP>0) {   
                        this->up(this->configuration->DROP_TIME);
                        going = GOING_UP;
                    }
                    this->state = STABILIZING;
                    this->stabilizationTimer = millis();

                }
                else{
                    this->state = STABLE;
                }
                break;
            case STABILIZING:
                if(
                    millis() - this->stabilizationTimer > this->configuration->STABILIZATION_TIME 
                ){
                    this->state = CONTROLING;
                }
                break;
            default:
                break;
        }
        
        
        
    } else {
        this->state = STABLE;        
    }
    return going;
}


void Control::setManualMode(bool manualMode){
  this->manualMode = manualMode;
}
void Control::down(int dropTime) {
    if(this->configuration->M_DN>0){
        analogWrite(this->configuration->M_DN, this->configuration->M_DN_SPEED);
        delay(dropTime);
        analogWrite(this->configuration->M_DN, this->configuration->ZERO_SPEED);
    }
}

void Control::up(int dropTime) {
    
    if(this->configuration->M_UP>0){
        analogWrite(this->configuration->M_UP, this->configuration->M_UP_SPEED);
        delay(dropTime);
        analogWrite(this->configuration->M_UP, this->configuration->ZERO_SPEED);
    }
}
