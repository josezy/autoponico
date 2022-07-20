
#ifndef AVERAGE_FILTER_H
#define AVERAGE_FILTER_H
#include <stdint.h> 

class AverageFilter {
    float* samplesArray;
    const uint8_t samplesAmount ;
    uint8_t samplesIndex = 0;

    float takeSampleTimer;
    float takeSamplePeriod;

    public:
        AverageFilter(const uint8_t samplesAmount = 10, const float takeSamplePeriod = 5000);
        void setCurrentValue(float current);
        float getMeasureFromSamples();
    
};
#endif