#include "Control.h"

Control::Control(ControlConfig* configuration) {
    this->configuration = configuration;
    this->stabilizationTimer = millis();

    if (configuration->M_UP_PIN > 0)
        pinMode(configuration->M_UP_PIN, OUTPUT);
    if (configuration->M_DN_PIN > 0)
        pinMode(configuration->M_DN_PIN, OUTPUT);
}

const char* Control::getControlText(int control_type) {
    switch (control_type) {
        case GOING_UP:
            return "UP";
        case GOING_DOWN:
            return "DOWN";
        default:
            return "NONE";
    }
}

float Control::getSetPoint() {
    return this->setPoint;
}

void Control::setSetPoint(float setPoint) {
    this->setPoint = setPoint;
}

float Control::getCurrent() {
    return this->current;
}

void Control::setCurrent(float current) {
    this->current = current;
}

int Control::doControl() {
    int going = GOING_NONE;

    this->error = this->current - this->setPoint;

    if (this->autoMode) {
        switch (this->state) {
            case STABLE:
                if (
                    abs(this->error) >= this->configuration->ERR_MARGIN &&
                    this->current != 0) {
                    this->state = CONTROLING;
                }
                break;
            case CONTROLING:
                if (
                    abs(this->error) >= this->configuration->STABILIZATION_MARGIN) {
                    if (this->error > 0 && this->current != 0 && this->configuration->M_DN_PIN > 0) {
                        this->down(this->configuration->DROP_TIME);
                        going = GOING_DOWN;
                    } else if (this->error < 0 && this->current != 0 && this->configuration->M_UP_PIN > 0) {
                        this->up(this->configuration->DROP_TIME);
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
                    millis() - this->stabilizationTimer > this->configuration->STABILIZATION_TIME) {
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

void Control::setAutoMode(bool flag) {
    this->autoMode = flag;
}

bool Control::getAutoMode() {
    return this->autoMode;
}

void Control::down(int dropTime) {
    if (this->configuration->M_DN_PIN > 0) {
        analogWrite(this->configuration->M_DN_PIN, this->configuration->M_DN_SPEED);
        delay(dropTime);
        analogWrite(this->configuration->M_DN_PIN, this->configuration->ZERO_SPEED);
    }
}

void Control::up(int dropTime) {
    if (this->configuration->M_UP_PIN > 0) {
        analogWrite(this->configuration->M_UP_PIN, this->configuration->M_UP_SPEED);
        delay(dropTime);
        analogWrite(this->configuration->M_UP_PIN, this->configuration->ZERO_SPEED);
    }
}
