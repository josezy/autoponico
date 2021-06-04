#include <ShiftRegister74HC595.h>

#define M1 9
#define M2 10
#define M1_SPEED 130
#define M2_SPEED 170
#define ZERO_SPEED 0

#define PH_PIN A7
#define POT_PIN A6

#define DISPLAYS_QUANTITY 2

#define SEG7_DATA 5
#define SEG7_LATCH 6
#define SEG7_CLOCK 7

#define DROP_TIME 100

// Controller constants
#define ERR_MARGIN 0.4
#define STABILIZATION_MARGIN 0.2

#define MINUTE 1000L * 60

#define STABILIZATION_TIME 2 * MINUTE
#define POST_CONTROL_TIME 5 * MINUTE
#define SLEEPING_TIME 30 * MINUTE

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

float error;

void setup() {
    pinMode(M1, OUTPUT);
    pinMode(M2, OUTPUT);
    pinMode(POT_PIN, INPUT);

    Serial.begin(115200);
}

void loop() {
    float pH = get_pH();
    show_in_display(pH);
    /*
        pH control v1.0, highly blocking flow:
        - measure error
        - if error > ERR_MARGIN
            - do while error > STABILIZATION_MARGIN
                - supply dosage -- may it be computed?
                - wait STABILIZATION_TIME -- may it be computed?
                - measure error
            - wait POST_CONTROL_TIME
        - wait SLEEPING_TIME
    */
    // TODO: make it non-blocking for good displays visualization
    /*
    error = get_pH() - get_desired_pH();

    if (abs(error) > ERR_MARGIN) {
        do {
            if (error > 0) {
                pH_down();
            } else {
                pH_up();
            }
            delay(STABILIZATION_TIME);
            error = get_pH() - get_desired_pH();
        } while (abs(error) > STABILIZATION_MARGIN);
        delay(POST_CONTROL_TIME);
    }
    delay(SLEEPING_TIME);
    */
}

float get_desired_pH() {
    return map(analogRead(POT_PIN), 0, 1023, 0, 14);
}

float get_pH() {
    const uint8_t samples = 20;
    int measurings = 0;
    
    for (int i = 0; i < samples; i++) {
        measurings += analogRead(PH_PIN);
        delay(50);
    }
    
    float voltage = measurings / samples;
    float slope = 0.0257;
    float yAxisIntercept = 21.1;
    
    return yAxisIntercept - slope*voltage;
}

void pH_up() {
    analogWrite(M2, ZERO_SPEED);
    analogWrite(M1, M1_SPEED);
    delay(DROP_TIME);
    analogWrite(M1, ZERO_SPEED);
}

void pH_down() {
    analogWrite(M1, ZERO_SPEED);
    analogWrite(M2, M2_SPEED);
    delay(DROP_TIME);
    analogWrite(M2, ZERO_SPEED);
}

void calm_down() {
    analogWrite(M1, ZERO_SPEED);
    analogWrite(M2, ZERO_SPEED);
}

void show_in_display(float ph) {
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
