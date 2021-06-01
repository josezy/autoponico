//#include "TM1637.h"

#define M1 9
#define M2 10
#define M1_SPEED 130
#define M2_SPEED 170
#define DEFAULT_SPEED 0

#define PH_PIN A7

#define SEG7_CLK 6
#define SEG7_DIO 7

#define WATER_DROP_TIME 100

//TM1637 tm1637(SEG7_CLK, SEG7_DIO);

void setup() {
    pinMode(M1, OUTPUT);
    pinMode(M2, OUTPUT);
    
    Serial.begin(115200);

    // tm1637.init();
    // tm1637.set(BRIGHT_TYPICAL);
    // float num = 12.8;
    // Serial.println(num);
    // tm1637.displayNum(num, 2, false);
}

void loop() {
    pH_up();
    calm_down();
    delay(5000);
    
    pH_down();
    calm_down();
    delay(5000);
    
    Serial.print("Pot: ");
    Serial.print(analogRead(A0));
    Serial.print("\tpH: ");
    Serial.print(get_pH());
    Serial.print("\n");
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
    analogWrite(M2, DEFAULT_SPEED);
    analogWrite(M1, M1_SPEED);
    delay(WATER_DROP_TIME);
}

void pH_down() {
    analogWrite(M1, DEFAULT_SPEED);
    analogWrite(M2, M2_SPEED);
    delay(WATER_DROP_TIME);
}

void calm_down() {
    analogWrite(M1, DEFAULT_SPEED);
    analogWrite(M2, DEFAULT_SPEED);
}