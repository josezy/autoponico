

#include "DisplaysTM1637.h"


#include <TM1637.h>

DisplaysTM1637::DisplaysTM1637(uint8_t CurrentCLK, uint8_t CurrentDIO, uint8_t setPointCLK, uint8_t setPointDIO){  
  this->currentDisplay = new TM1637(CurrentCLK, CurrentDIO);
  this->setPointDisplay = new TM1637(setPointCLK, setPointDIO);
}

void DisplaysTM1637::initDisplays(){
    this->currentDisplay->init();
    this->currentDisplay->set(2);

    this->setPointDisplay->init();
    this->setPointDisplay->set(2);
}

void DisplaysTM1637::display(int num, String type)
{

  if (type.equals("sense"))
  {

    this->currentDisplay->display(3, num % 10);
    this->currentDisplay->display(2, num / 10 % 10);
    this->currentDisplay->display(1, num / 100 % 10);
    this->currentDisplay->display(0, num / 1000 % 10);
  }
  else
  {

    this->setPointDisplay->display(3, num % 10);
    this->setPointDisplay->display(2, num / 10 % 10);
    this->setPointDisplay->display(1, num / 100 % 10);
    this->setPointDisplay->display(0, num / 1000 % 10);
   
  }
}
