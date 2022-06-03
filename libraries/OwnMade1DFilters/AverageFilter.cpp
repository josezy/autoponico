
#include "AverageFilter.h"
#include <Arduino.h>
float AverageFilter::getMeasureFromSamples(){
    float mean = 0;
    for(int i = 0; i<this->samplesAmount ; i++){
        mean += this->samplesArray[i];
    }
    return mean/this->samplesAmount;
}
AverageFilter::AverageFilter(const uint8_t samplesAmount , const float takeSamplePeriod){
    this->samplesAmount = samplesAmount;
    this->takeSamplePeriod = takeSamplePeriod;
    this->takeSampleTimer = millis();
}
void AverageFilter::setCurrentValue(float current){
   if(millis()-this->takeSampleTimer>this->takeSamplePeriod){
        this->takeSampleTimer = millis();
        (*(this->samplesArray+this->samplesIndex)) = current;     
        this->samplesIndex++;
        if(this->samplesIndex>=this->samplesAmount)
            this->samplesIndex = 0;
    }
}