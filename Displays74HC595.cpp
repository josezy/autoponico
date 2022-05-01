

#include "Displays74HC595.h"

#include <ShiftRegister74HC595.h>

Displays74HC595::Displays74HC595(
  uint8_t currentData, uint8_t currentClock, uint8_t currentLatch,
  uint8_t setPointData, uint8_t setPointClock, uint8_t setPointLatch  
){  
  this->currentDisplay = new ShiftRegister74HC595<NUM_DIGITS>(currentData, currentClock, currentLatch);
  this->setPointDisplay = new ShiftRegister74HC595<NUM_DIGITS>(setPointData, setPointClock, setPointLatch);
}


void Displays74HC595::display(float value, String type)
{

  int valueWithoutDecimals = value * 10;

  int firstDigit = valueWithoutDecimals / 10;
  int secondDigit = valueWithoutDecimals % 10;

  uint8_t numberToPrint[] = {firstDisplay[firstDigit], secondDisplay[secondDigit]};


  if (type.equals("sense"))
  {
    this->currentDisplay->setAll(numberToPrint);
  }
  else
  {

    this->setPointDisplay->setAll(numberToPrint);
   
  }
}
