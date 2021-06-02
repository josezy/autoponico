#include "TM1637.h"

#define M1 9
#define M2 10
#define M1_SPEED 130
#define M2_SPEED 170
#define ZERO_SPEED 0

#define PH_PIN A7
#define POT_PIN A6

#define SEG7_CPH_CLK 6
#define SEG7_CPH_DIO 7

#define SEG7_DPH_CLK 4
#define SEG7_DPH_DIO 5

#define DROP_TIME 100

// Controller constants
#define ERR_MARGIN 0.4
#define STABILIZATION_MARGIN 0.2

#define MINUTE 1000L * 60

#define STABILIZATION_TIME 2 * MINUTE
#define POST_CONTROL_TIME 5 * MINUTE
#define SLEEPING_TIME 30 * MINUTE

float error;

TM1637 current_ph_display(SEG7_CPH_CLK, SEG7_CPH_DIO);
TM1637 desired_ph_display(SEG7_DPH_CLK, SEG7_DPH_DIO);

void setup() {
    pinMode(M1, OUTPUT);
    pinMode(M2, OUTPUT);
    pinMode(POT_PIN, INPUT);

    Serial.begin(115200);

    current_ph_display.init();
    desired_ph_display.init();

    current_ph_display.set(BRIGHT_TYPICAL);
    desired_ph_display.set(BRIGHT_TYPICAL);

    // Example of displays use
    // float num = 12.8;
    // current_ph_display.displayNum(num, 2, false);
}

void loop() {
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
    const float x = measurings / samples;
    return -0.0257 * x + 21.1;
}

void pH_up() {
    analogWrite(M1, M1_SPEED);
    delay(DROP_TIME);
    analogWrite(M1, ZERO_SPEED);
}

void pH_down() {
    analogWrite(M2, M2_SPEED);
    delay(DROP_TIME);
    analogWrite(M2, ZERO_SPEED);
}
