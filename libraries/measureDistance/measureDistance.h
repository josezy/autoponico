#ifndef MEASURE_DIST_H
#define MEASURE_DIST_H

class MeasureDistance
{
    int trigPin;
    int echoPin;
    float distance = 0;

public:
    MeasureDistance(const int trigPin = 9, const int echoPin = 10);
    float takeMeasure();
};
#endif
