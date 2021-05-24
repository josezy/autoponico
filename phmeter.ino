#include "TM1637.h"

#define M1 5
#define M2 6
#define M_SPEED 200

#define PH_PIN A7

#define SEG7_CLK 6
#define SEG7_DIO 7

TM1637 tm1637(SEG7_CLK, SEG7_DIO);

void setup() {
    pinMode(13, OUTPUT);
    pinMode(M1, OUTPUT);
    pinMode(M2, OUTPUT);
    analogWrite(M1, M_SPEED);
    analogWrite(M2, M_SPEED);
    Serial.begin(115200);

    tm1637.init();
    tm1637.set(BRIGHT_TYPICAL);
    float num = 12.8;
    Serial.println(num);
    tm1637.displayNum(num, 2, false);
}

void loop() {
    digitalWrite(13, HIGH);
    delay(500);
    digitalWrite(13, LOW);
    delay(500);
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
