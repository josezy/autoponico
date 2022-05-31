#include "EcSensor.h"

#include <OneWire.h>
#include <DallasTemperature.h>
#include <Arduino.h> //needed for Serial.println

EcSensor::EcSensor(ECSensorConfig* configuration)
{
    this->configuration = configuration;
    this->oneWire = new OneWire(configuration->ONE_WIRE_PIN);
    this->sensors = new DallasTemperature(oneWire);
    this->measureTimer = millis();
    pinMode(configuration->TEMP_PROBE_NEGATIVE, OUTPUT);   //seting ground pin as output for tmp probe
    digitalWrite(configuration->TEMP_PROBE_NEGATIVE, LOW); //Seting it to ground so it can sink current
    pinMode(configuration->TEMP_PROBE_POSSITIVE, OUTPUT);  //ditto but for positive
    digitalWrite(configuration->TEMP_PROBE_POSSITIVE, HIGH);

    pinMode(configuration->EC_PIN, INPUT);
    pinMode(configuration->EC_POWER, OUTPUT); //Setting pin for sourcing current
    pinMode(configuration->EC_GND, OUTPUT);   //setting pin for sinking current
    digitalWrite(configuration->EC_GND, LOW); //We can leave the ground connected permanantly

    delay(100); // gives sensor time to settle
    this->sensors->begin();
    delay(100);
    //** Adding Digital Pin Resistance to [25 ohm] to the static Resistor *********//
    // Consule Read-Me for Why, or just accept it as true
    this->R1 = (this->R1 + this->Ra); // Taking into acount Powering Pin Resitance

}

float EcSensor::getEc()
{
    //Calls Code to Go into GetEC() Loop [Below Main Loop] dont call this more that 1/5 hhz [once every five seconds] or you will polarise the water
    if (millis() - this->measureTimer > MILLIS_BETWEEN_READ)
    {

        this->measureTimer = millis();
        //*********Reading Temperature Of Solution *******************//
        this->sensors->requestTemperatures();            // Send the command to get temperatures
        this->Temperature = this->sensors->getTempCByIndex(0); //Stores Value in Variable
        //************Estimates Resistance of Liquid ****************//
        digitalWrite(this->configuration->EC_POWER, HIGH);
        this->raw = analogRead(this->configuration->EC_PIN);
        this->raw = analogRead(this->configuration->EC_PIN); // This is not a mistake, First reading will be low beause if charged a capacitor
        digitalWrite( this->configuration->EC_POWER, LOW);
        //***************** Converts to EC **************************//
        this->Vdrop = (this->Vin * this->raw) / 1024.0;
        this->Rc = (this->Vdrop * this->R1) / (this->Vin - this->Vdrop);
        this->Rc = this->Rc - this->Ra; //acounting for Digital Pin Resitance
        this->EC = 1000 / (this->Rc * this->configuration->K);
        //*************Compensating For Temperaure********************//
        this->EC25 = this->EC / (1 + TEMP_COEF * (this->Temperature - 25.0));
        this->ppm = (this->EC25) * (PPM_FACTOR * 1000);
    }
    return this->ppm;
}