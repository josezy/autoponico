

#include "Displays.h"
#include <TM1637.h>


TM1637 currentDisplay(CURRENT_CLOCK, CURRENT_DIO);
TM1637 desiredDisplay(DESIRED_CLOCK, DESIRED_DIO);

void Displays::initDisplays(){
    currentDisplay.init();
    currentDisplay.set(2);

    desiredDisplay.init();
    desiredDisplay.set(2);
}

void Displays::display(int num, String type)
{
  if (type.equals("sense"))
  {

    currentDisplay.display(3, num % 10);
    currentDisplay.display(2, num / 10 % 10);
    currentDisplay.display(1, num / 100 % 10);
    currentDisplay.display(0, num / 1000 % 10);
  }
  else
  {
    desiredDisplay.display(3, num % 10);
    desiredDisplay.display(2, num / 10 % 10);
    desiredDisplay.display(1, num / 100 % 10);
    desiredDisplay.display(0, num / 1000 % 10);
  }
}
