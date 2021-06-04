#include <ShiftRegister74HC595.h>

#define M1 9
#define M2 10
#define M1_SPEED 130
#define M2_SPEED 170
#define DEFAULT_SPEED 0

#define PH_PIN A7

#define DISPLAYS_QUANTITY 2

#define SEG7_DATA 5
#define SEG7_LATCH 6
#define SEG7_CLOCK 7

#define WATER_DROP_TIME 100

ShiftRegister74HC595<DISPLAYS_QUANTITY> sr (SEG7_DATA, SEG7_CLOCK, SEG7_LATCH);

uint8_t firstDisplay[] = { 
    B01000000, //0.
    B01111001, //1. 
    B00100100, //2.
    B00110000, //3. 
    B00011001, //4.
    B00010010, //5.
    B00000011, //6.
    B01111000, //7.
    B00000000, //8.
    B00011000  //9.
};

uint8_t secondDisplay[] = { 
    B11000000, //0
    B11111001, //1 
    B10100100, //2
    B10110000, //3 
    B10011001, //4
    B10010010, //5
    B10000011, //6
    B11111000, //7
    B10000000, //8
    B10011000  //9
};

void setup() {
    pinMode(M1, OUTPUT);
    pinMode(M2, OUTPUT);
    
    Serial.begin(115200);
}

void loop() {
    float pH = getPh();
    showInDisplay(pH);
}

float getPh() {
    const uint8_t samples = 10;
    int measurings = 0;
    
    for (int i = 0; i < samples; i++) {
        measurings += analogRead(PH_PIN);
        delay(10);
    }
    
    float voltage = measurings / samples;
    float slope = 0.0257;
    float yAxisIntercept = 21.1;
    
    return yAxisIntercept - slope*voltage;
}

void phUp() {
    analogWrite(M2, DEFAULT_SPEED);
    analogWrite(M1, M1_SPEED);
    delay(WATER_DROP_TIME);
}

void phDown() {
    analogWrite(M1, DEFAULT_SPEED);
    analogWrite(M2, M2_SPEED);
    delay(WATER_DROP_TIME);
}

void calmDown() {
    analogWrite(M1, DEFAULT_SPEED);
    analogWrite(M2, DEFAULT_SPEED);
}

void showInDisplay(float ph) {
  int phWithoutDecimals = ph*10;

  int firstDigit = phWithoutDecimals / 10;
  int secondDigit = phWithoutDecimals % 10;

  show(firstDigit, secondDigit);
}

void show(int firstDigit, int secondDigit) {
  uint8_t numberToPrint[]= { firstDisplay[firstDigit], secondDisplay[secondDigit] };
  sr.setAll(numberToPrint); 
  
  delay(1000);
}