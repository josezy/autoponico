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

TM1637 current_ph_display(SEG7_CPH_CLK, SEG7_CPH_DIO);
TM1637 desired_ph_display(SEG7_DPH_CLK, SEG7_DPH_DIO);

void setup() {
    pinMode(M1, OUTPUT);
    pinMode(M2, OUTPUT);
    
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
            - while error > STABILIZATION_MARGIN
                - supply dosage -- may it be computed?
                - wait STABILIZATION_TIME -- may it be computed?
                - measure error
            - wait POST_CONTROL_TIME
        - wait SLEEPING_TIME
    */
    float error = get_pH() - get_desired_pH();
    // TODO: jose :D
    // TODO 2: make it non-blocking for good displays visualization

    // For testing, remove
    pH_up();
    delay(5000);
    
    pH_down();
    delay(5000);

    Serial.print("Pot: ");
    Serial.print(analogRead(POT_PIN));
    Serial.print("\tpH: ");
    Serial.print(get_pH());
    Serial.print("\n");
}

float get_desired_pH() {
    return map(analogRead(POT_PIN), 0, 1023, 0, 14);
}

float get_pH() {
    const uint8_t samples = 10;
    int measurings = 0;
    for (int i = 0; i < samples; i++) {
        measurings += analogRead(PH_PIN);
        delay(10);
    }
    float voltage = 5 / 1024.0 * measurings / samples;
    return 7 + ((2.5 - voltage) / 0.18);
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
