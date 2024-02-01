#include "Control.h"

Control::Control(ControlConfig* configuration) {
    this->configuration = configuration;
    this->stabilizationTimer = millis();

    if (configuration->M_UP_PIN > 0)
        pinMode(configuration->M_UP_PIN, OUTPUT);
    if (configuration->M_DN_PIN > 0)
        pinMode(configuration->M_DN_PIN, OUTPUT);
}

int Control::doControl() {
    int going = GOING_NONE;

    this->error = this->current - this->setpoint;

    if (this->autoMode) {
        switch (this->state) {
            case STABLE:
                if (
                    abs(this->error) >= this->ERR_MARGIN &&
                    this->current != 0) {
                    this->state = CONTROLLING;
                }
                break;
            case CONTROLLING:
                if (
                    abs(this->error) >= this->STABILIZATION_MARGIN) {
                    if (this->error > 0 && this->current != 0 && this->configuration->M_DN_PIN > 0) {
                        this->down(this->DROP_TIME);
                        going = GOING_DOWN;
                    } else if (this->error < 0 && this->current != 0 && this->configuration->M_UP_PIN > 0) {
                        this->up(this->DROP_TIME);
                        going = GOING_UP;
                    }
                    this->state = STABILIZING;
                    this->stabilizationTimer = millis();

                } else {
                    this->state = STABLE;
                }
                break;
            case STABILIZING:
                if (
                    millis() - this->stabilizationTimer > this->STABILIZATION_TIME) {
                    this->state = CONTROLLING;
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

void Control::down(int dropTime) {
    if (this->configuration->M_DN_PIN > 0) {
        analogWrite(this->configuration->M_DN_PIN, this->configuration->M_DN_SPEED);
        delay(dropTime);
        analogWrite(this->configuration->M_DN_PIN, ZERO_SPEED);
    }
}

void Control::up(int dropTime) {
    if (this->configuration->M_UP_PIN > 0) {
        analogWrite(this->configuration->M_UP_PIN, this->configuration->M_UP_SPEED);
        delay(dropTime);
        analogWrite(this->configuration->M_UP_PIN, ZERO_SPEED);
    }
}
