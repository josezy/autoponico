#include <ShiftRegister74HC595.h>

#define M_PH_UP 8
#define M_PH_DN 9
#define M_PH_UP_SPEED 130
#define M_PH_DN_SPEED 170
#define ZERO_SPEED 0

#define PH_PIN A7
#define POT_PIN A0

#define NUM_DIGITS 2

#define CURRENT_SEG7_DATA 2
#define CURRENT_SEG7_CLOCK 3
#define CURRENT_SEG7_LATCH 4
#define DESIRED_SEG7_DATA 5
#define DESIRED_SEG7_CLOCK 6
#define DESIRED_SEG7_LATCH 7

#define DROP_TIME 100

// Controller constants
#define ERR_MARGIN 0.4
#define STABILIZATION_MARGIN 0.2

#define MINUTE 1000L * 60
#define STABILIZATION_TIME 1 * MINUTE

#define SLEEPING_TIME 100

ShiftRegister74HC595<NUM_DIGITS> desired_display (DESIRED_SEG7_DATA, DESIRED_SEG7_CLOCK, DESIRED_SEG7_LATCH);
ShiftRegister74HC595<NUM_DIGITS> current_display (CURRENT_SEG7_DATA, CURRENT_SEG7_CLOCK, CURRENT_SEG7_LATCH);

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

float pH;
float desired_pH;
float error;


void test_system() {
    // test displays
    Serial.println("Testing CURRENT display");
    for (float i = 0.0; i < 10.0; i += 1.1) { show_in_current_display(i); delay(100); }
    Serial.println("Testing DESIRED display");
    for (float i = 0.0; i < 10.0; i += 1.1) { show_in_desired_display(i); delay(100); }

    // test pumps
    Serial.println("Testing ph UP");
    for (int i = 1; i <= 10; i++) { pH_up(); delay(50); }
    Serial.println("Testing ph DOWN");
    for (int i = 1; i <= 10; i++) { pH_down(); delay(50); }
}

void setup() {
    pinMode(M_PH_UP, OUTPUT);
    pinMode(M_PH_DN, OUTPUT);
    pinMode(POT_PIN, INPUT);
    pinMode(PH_PIN, INPUT);

    Serial.begin(115200);
    // test_system();
}

void loop() {
    pH = get_pH();
    desired_pH = get_desired_pH();
    show_in_current_display(pH);
    show_in_desired_display(desired_pH);

    error = pH - desired_pH;
    Serial.print("Initial error: ");
    Serial.println(error);

    if (abs(error) > ERR_MARGIN) {
        do {
            if (error > 0) {
                pH_down();
                Serial.println("Going down down");
            } else {
                pH_up();
                Serial.println("Going up up");
            }

            long start = millis();
            while (millis() - start < STABILIZATION_TIME) {
                delay(10);

                pH = get_pH();
                desired_pH = get_desired_pH();
                show_in_current_display(pH);
                show_in_desired_display(desired_pH);
                Serial.print("pH: ");
                Serial.print(pH);
                Serial.print("\t\tdesired_pH: ");
                Serial.print(desired_pH);

                error = pH - desired_pH;
                Serial.print("\t\tLoop error: ");
                Serial.println(error);
            }
        } while (abs(error) > STABILIZATION_MARGIN);
    }
    delay(SLEEPING_TIME);
}
 

float get_desired_pH() {
    return map(analogRead(POT_PIN), 0, 1023, 50, 70) / 10.0;
}

float get_pH() {
    const uint8_t samples = 30;
    int measurings = 0;

    for (int i = 0; i < samples; i++) {
        measurings += analogRead(PH_PIN);
        delay(50);
    }

    float reading = measurings / samples;
    float m = -0.0257;
    float b = 21.1;

    return m * reading + b;
}

void pH_up() {
    analogWrite(M_PH_DN, ZERO_SPEED);
    analogWrite(M_PH_UP, M_PH_UP_SPEED);
    delay(DROP_TIME);
    analogWrite(M_PH_UP, ZERO_SPEED);
}

void pH_down() {
    analogWrite(M_PH_UP, ZERO_SPEED);
    analogWrite(M_PH_DN, M_PH_DN_SPEED);
    delay(DROP_TIME);
    analogWrite(M_PH_DN, ZERO_SPEED);
}

void show_in_desired_display(float ph) {
    int phWithoutDecimals = ph * 10;

    int firstDigit = phWithoutDecimals / 10;
    int secondDigit = phWithoutDecimals % 10;

    uint8_t numberToPrint[] = { firstDisplay[firstDigit], secondDisplay[secondDigit] };
    desired_display.setAll(numberToPrint); 
}

void show_in_current_display(float ph) {
    int phWithoutDecimals = ph * 10;

    int firstDigit = phWithoutDecimals / 10;
    int secondDigit = phWithoutDecimals % 10;

    uint8_t numberToPrint[] = { firstDisplay[firstDigit], secondDisplay[secondDigit] };
    current_display.setAll(numberToPrint); 
}
