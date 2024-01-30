#ifndef CONTROL_H
#define CONTROL_H

#define GOING_UP 1
#define GOING_NONE 0
#define GOING_DOWN -1

#define STABLE 0
#define CONTROLLING 1
#define STABILIZING 2

#define ZERO_SPEED 0

#include <Arduino.h>
#include <stdint.h>

struct ControlConfig {
    const uint16_t M_UP_PIN;
    const uint16_t M_DN_PIN;
    const uint32_t M_UP_SPEED;
    const uint32_t M_DN_SPEED;
};

class Control {
    ControlConfig* configuration;
    int state = STABLE;
    float error;
    float stabilizationTimer;

   public:
    bool autoMode = false;
    float current = 0;
    float setpoint;
    uint32_t DROP_TIME;
    float ERR_MARGIN;
    long int STABILIZATION_TIME;
    float STABILIZATION_MARGIN;

    Control(ControlConfig* configuration);
    void up(int dropTime);
    void down(int dropTime);
    int doControl();
};

#endif
