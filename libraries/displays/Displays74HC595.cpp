

#include "Displays74HC595.h"

#include <ShiftRegister74HC595.h>

uint8_t firstDisplay[] = {
    B01000000,  // 0.
    B01111001,  // 1.
    B00100100,  // 2.
    B00110000,  // 3.
    B00011001,  // 4.
    B00010010,  // 5.
    B00000011,  // 6.
    B01111000,  // 7.
    B00000000,  // 8.
    B00011000   // 9.
};

uint8_t secondDisplay[] = {
    B11000000,  // 0
    B11111001,  // 1
    B10100100,  // 2
    B10110000,  // 3
    B10011001,  // 4
    B10010010,  // 5
    B10000011,  // 6
    B11111000,  // 7
    B10000000,  // 8
    B10011000   // 9
};
Displays74HC595::Displays74HC595(
  uint8_t currentData, uint8_t currentClock, uint8_t currentLatch,
  uint8_t setPointData, uint8_t setPointClock, uint8_t setPointLatch  
){  
  this->currentDisplay = new ShiftRegister74HC595<NUM_DIGITS>(currentData, currentClock, currentLatch);
  this->setPointDisplay = new ShiftRegister74HC595<NUM_DIGITS>(setPointData, setPointClock, setPointLatch);
}

Displays74HC595::Displays74HC595(
    uint8_t setPointData, uint8_t setPointClock, uint8_t setPointLatch)
{
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
    if (this->currentDisplay != NULL)
      this->currentDisplay->setAll(numberToPrint);
  }
  else
  {

    if (this->setPointDisplay != NULL)
      this->setPointDisplay->setAll(numberToPrint);
   
  }
}
