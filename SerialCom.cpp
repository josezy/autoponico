
#include "SerialCom.h"
#include <Arduino_JSON.h>
#include <Arduino.h> //needed for Serial.println

SerialCom::SerialCom(const char* WHOAMI, SensorEEPROM* sensorEEPROM, Control* phControl, PhSensor* phSensor){
    this->sensorEEPROM = sensorEEPROM;
    this->phControl = phControl;
    this->phSensor = phSensor;
    this->WHOAMI = WHOAMI;
}

void SerialCom::init(int baudrate){
    this->serialWriteTimer = millis();
    Serial.begin(baudrate);    
}

void SerialCom::printTask( char* task, float value, float desiredValue, const char* going, bool now){
  if(millis()-this->serialWriteTimer > SERIAL_WRITE_TIME || now){
    this->serialWriteTimer = millis();
    JSONVar Data;
    Data["WHOAMI"]=this->WHOAMI;
    Data["TASK"]=task;
    Data["GOING"]=going;
    Data["VALUE"]=value;
    Data["DESIRED"]=desiredValue;
    Serial.println(JSON.stringify(Data));
  }  
}

void SerialCom::checkForCommand(){
    if (Serial.available() > 0) {
        String msg = Serial.readString();
        JSONVar myObject = JSON.parse(msg);
        JSONVar Data;
        String command = "NONE";
        command = myObject["COMMAND"];
        if (command.equals("PHREAD")) {
            Data["VALUE"] = "Ph";
            Data["DESIRED_PH"] = "sasd";
            Data["ACK"] = "DONE";
            Data["MSG"] = msg;
        } else if (command.equals("PHUP")) {
            int dropTime = myObject["DROP_TIME"];
            this->phControl->up(dropTime);

            Data["MSG"] = msg;
            Data["ACK"] = "DONE";
        } else if (command.equals("PHDOWN")) {
            int dropTime = myObject["DROP_TIME"];
            this->phControl->down(dropTime);
            Data["MSG"] = msg;
            Data["ACK"] = "DONE";
        } else if (command.equals("AUTO")) {

            this->phControl->setManualMode(false);

            Data["MSG"] = msg;
            Data["ACK"] = "DONE";
        } else if (command.equals("MANUAL")) {

            this->phControl->setManualMode(true);

            Data["MSG"] = msg;
            Data["ACK"] = "DONE";
        } else if (command.equals("SET_PH")) {        
            this->phControl->setReadSetPointFromCMD(true);
            this->phControl->setSetPoint(
              (double) myObject["VALUE"]
            );
            
            this->sensorEEPROM->desiredPhToEEPROM(
              this->phControl->getSetPoint()
            );            

            Data["MSG"] = msg;
            Data["ACK"] = "DONE";
        } else if (command.equals("DESIRED_SOURCE")) {               
            String cmd_or_pot ="";
            cmd_or_pot = myObject["VALUE"];                     
            this->phControl->setReadSetPointFromCMD(cmd_or_pot.equals("CMD"));    
            Data["FROM_CMD"] = this->phControl->getReadSetPointFromCMD();            
            Data["MSG"] = msg;
            Data["ACK"] = "DONE";
        }
        else if (command.equals("WHOAMI")) {               
            Data["WHOAMI"] = this->WHOAMI;
            Data["MSG"] = msg;
            Data["ACK"] = "DONE";
        }
        else {
            Data["ACK"] = "ERROR";
            Data["MSG"] = msg;
        }

        Serial.println(JSON.stringify(Data));
    }
}
