
#include "SerialCom.h"

#include <Arduino.h>  // Needed for Serial
#include <Arduino_JSON.h>

SerialCom::SerialCom(SensorEEPROM* sensorEEPROM, Control* control, int baudrate) {
    this->sensorEEPROM = sensorEEPROM;
    this->control = control;
    this->baudrate = baudrate;
}

void SerialCom::init() {
    Serial.begin(this->baudrate);
}

char* floatToCharArray(float value) {
    char sz[20] = {' '};
    int val_int = (int)value; // compute the integer part of the float
    float val_float = (abs(value) - abs(val_int)) * 10000;
    int val_fra = (int)val_float;
    sprintf(sz, "%d.%d", val_int, val_fra); //
    return sz;
}

void SerialCom::printTask(
    const char* whoami,
    const char* task,
    float value,
    float desiredValue,
    const char* going
)
{
    char Data[1000]={""};
    strcat(Data, 'WHOAMI:');
    strcat(Data, whoami);
    strcat(Data, ',');

    strcat(Data, 'TASK:');
    strcat(Data, task);
    strcat(Data, ',');

    if (task == "CONTROL"){
        strcat(Data, 'GOING:');
        strcat(Data, going);
        strcat(Data, ',');
    }

    strcat(Data, 'VALUE:');
    strcat(Data, floatToCharArray(value));
    strcat(Data, ',');

    strcat(Data, 'DESIRED:');
    strcat(Data, floatToCharArray(desiredValue));
    strcat(Data, '}');

    Serial.println(Data);
}

void SerialCom::checkForCommand() {
    if (Serial.available() > 0) {
        String msg = Serial.readString();
        JSONVar myObject = JSON.parse(msg);
        JSONVar Data;
        String command = "";
        command = myObject["COMMAND"];

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
