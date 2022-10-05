#ifndef MEASURE_DIST_H
#define MEASURE_DIST_H

class measureDistance
{
    int trigPin;
    int echoPin;

public:
    measureDistance(const int trigPin = 9, const int echoPin = 10);
    float takeMeasure();
};
#endif
