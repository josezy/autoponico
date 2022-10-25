

#include "measureDistance.h"
#include <Arduino.h> 

MeasureDistance::MeasureDistance(const int trigPin, const int echoPin)
{
    this->trigPin = trigPin;
    this->echoPin = echoPin;

    pinMode(trigPin, OUTPUT); // Sets the trigPin as an Output
    pinMode(echoPin, INPUT);  // Sets the echoPin as an Input
}

float MeasureDistance::takeMeasure(){
    // Clears the trigPin
    digitalWrite(this->trigPin, LOW);
    delayMicroseconds(2);
    // Sets the trigPin on HIGH state for 10 micro seconds
    digitalWrite(this->trigPin, HIGH);
    delayMicroseconds(10);
    digitalWrite(this->trigPin, LOW);
    // Reads the echoPin, returns the sound wave travel time in microseconds
    // And calculating the distance
    return pulseIn(echoPin, HIGH) * 0.034 / 2;
}