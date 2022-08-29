
#include "SerialCom.h"

#include <Arduino.h>  //needed for Serial.println
#include <Arduino_JSON.h>

SerialCom::SerialCom(SensorEEPROM* sensorEEPROM, Control* control, float millisBetweenPrint) {
    this->sensorEEPROM = sensorEEPROM;
    this->control = control;
    this->millisBetweenPrint = millisBetweenPrint;
}

void SerialCom::init(int baudrate) {
    this->serialWriteTimer = millis();
    Serial.begin(baudrate);
}

void SerialCom::print(float data) {
    Serial.print(data);
}
void SerialCom::print(const char* data) {
    Serial.print(data);
}

void SerialCom::printTask(
    const char* whoami,
    const char* task,
    float value,
    float desiredValue,
    float temp,
    const char* going,
    bool now) {
    if (millis() - this->serialWriteTimer > this->millisBetweenPrint || now) {
        this->serialWriteTimer = millis();
        JSONVar Data;
        Data["WHOAMI"] = whoami;
        Data["TASK"] = task;
        Data["GOING"] = going;
        Data["VALUE"] = value;
        Data["DESIRED"] = desiredValue;
        Data["TEMP"] = temp;
        Serial.println(JSON.stringify(Data));
    }
}

void SerialCom::checkForCommand() {
    if (Serial.available() > 0) {
        String msg = Serial.readString();
        JSONVar myObject = JSON.parse(msg);
        String command = myObject["COMMAND"];
        JSONVar Data;

        if (command.equals("PHREAD")) {
            Data["VALUE"] = this->control->getCurrent();
            Data["DESIRED"] = this->control->getSetPoint();
            Data["ACK"] = "DONE";
            Data["MSG"] = msg;
        } else if (command.equals("PHUP")) {
            int dropTime = myObject["DROP_TIME"];
            this->control->up(dropTime);
            Data["MSG"] = msg;
            Data["ACK"] = "DONE";
        } else if (command.equals("PHDOWN")) {
            int dropTime = myObject["DROP_TIME"];
            this->control->down(dropTime);
            Data["MSG"] = msg;
            Data["ACK"] = "DONE";
        } else if (command.equals("AUTO")) {
            this->control->setManualMode(false);
            Data["MSG"] = msg;
            Data["ACK"] = "DONE";
        } else if (command.equals("MANUAL")) {
            this->control->setManualMode(true);
            Data["MSG"] = msg;
            Data["ACK"] = "DONE";
        } else if (command.equals("SET_PH")) {
            this->control->setReadSetPointFromCMD(true);
            this->control->setSetPoint(
                (double)myObject["VALUE"]);
            this->sensorEEPROM->desiredPhToEEPROM(
                this->control->getSetPoint());
            Data["MSG"] = msg;
            Data["ACK"] = "DONE";
        } else if (command.equals("DESIRED_SOURCE")) {
            String cmd_or_pot = "";
            cmd_or_pot = myObject["VALUE"];
            this->control->setReadSetPointFromCMD(cmd_or_pot.equals("CMD"));
            Data["FROM_CMD"] = this->control->getReadSetPointFromCMD();
            Data["MSG"] = msg;
            Data["ACK"] = "DONE";
        } else {
            Data["ACK"] = "ERROR";
            Data["MSG"] = msg;
        }

        Serial.println(JSON.stringify(Data));
    }
}
