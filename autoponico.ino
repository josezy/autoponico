#include <Arduino_JSON.h>
#include <ShiftRegister74HC595.h>
#include <SoftwareSerial.h>
#include <EEPROM.h>

#define M_PH_UP 8
#define M_PH_DN 9
#define M_PH_UP_SPEED 200
#define M_PH_DN_SPEED 200
#define ZERO_SPEED 0
//pH 5.0 => 9.0
//pHeeprom  0 => 255
#define MAX_DESIRED_PH 8.0
#define MIN_DESIRED_PH 5.0
#define DESIRED_PH_ADDRESS 0
#define DESIRED_PH_FLAG_ADDRESS 1

#define POT_PIN A0

#define NUM_DIGITS 2

#define CURRENT_SEG7_DATA 2
#define CURRENT_SEG7_CLOCK 3
#define CURRENT_SEG7_LATCH 4
#define DESIRED_SEG7_DATA 5
#define DESIRED_SEG7_CLOCK 6
#define DESIRED_SEG7_LATCH 7

#define PH_RX 10
#define PH_TX 11

#define DROP_TIME 1000

// Controller constants
#define ERR_MARGIN 0.3
#define STABILIZATION_MARGIN 0.1

#define MINUTE 1000L * 60
#define STABILIZATION_TIME 10 * MINUTE

#define SLEEPING_TIME 100

ShiftRegister74HC595<NUM_DIGITS> desired_display(DESIRED_SEG7_DATA, DESIRED_SEG7_CLOCK, DESIRED_SEG7_LATCH);
ShiftRegister74HC595<NUM_DIGITS> current_display(CURRENT_SEG7_DATA, CURRENT_SEG7_CLOCK, CURRENT_SEG7_LATCH);

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

boolean manualMode = true;

float pH;
float desired_pH;
float desired_pH_cmd  ;
bool desired_pH_from_cmd ;

float error;

String sensorstring = "";
boolean sensor_string_complete = false;

float ph_total = 0;
float ph_current = 0;
float ph_counter = 0;
const uint8_t max_samples = 1;

SoftwareSerial pH_Serial(PH_RX, PH_TX);

void test_system() {
    // test displays
    Serial.println("Testing CURRENT display");
    for (float i = 0.0; i < 10.0; i += 1.1) {
        show_in_current_display(i);
        delay(100);
    }
    Serial.println("Testing DESIRED display");
    for (float i = 0.0; i < 10.0; i += 1.1) {
        show_in_desired_display(i);
        delay(100);
    }

    // test pumps
    Serial.println("Testing ph UP");
    for (int i = 1; i <= 10; i++) {
        pH_up(DROP_TIME);
        delay(50);
    }
    Serial.println("Testing ph DOWN");
    for (int i = 1; i <= 10; i++) {
        pH_down(DROP_TIME);
        delay(50);
    }
}
//----------------------//
//---- EEPROM  ---------//
void desired_pH_to_eeprom(float cmd_pH) {
    EEPROM.write(DESIRED_PH_ADDRESS, map((int)(cmd_pH*10), MIN_DESIRED_PH*10, MAX_DESIRED_PH*10, 0, 255));
}

//----------------------//

//---- MAIN  ---------//
void setup() {
    pinMode(M_PH_UP, OUTPUT);
    pinMode(M_PH_DN, OUTPUT);
    pinMode(POT_PIN, INPUT);

    Serial.begin(9600);
    pH_Serial.begin(9600);
    desired_pH_cmd = map(EEPROM.read(DESIRED_PH_ADDRESS), 0, 255, MIN_DESIRED_PH*10, MAX_DESIRED_PH*10)/10.0;
    desired_pH_from_cmd = EEPROM.read(DESIRED_PH_FLAG_ADDRESS)==1;
    // test_system();
}

void loop() {
   
    get_measure_error_and_show();
    print_measure_and_setpoint();
    check_for_command();               

    if (!manualMode) {

        if (abs(error) >= ERR_MARGIN) {
            do {
                if (error > 0) {
                    pH_down(DROP_TIME);
                    Serial.println("Going down down");
                } else {
                    pH_up(DROP_TIME);
                    Serial.println("Going up up");
                }

                long start = millis();
                while (millis() - start < STABILIZATION_TIME) {           
                    delay(SLEEPING_TIME);
                    get_measure_error_and_show();
                    print_measure_and_setpoint();
                    check_for_command();         

                  
                }
            } while (abs(error) > STABILIZATION_MARGIN);
        }
    }
    delay(SLEEPING_TIME);
}

void get_measure_error_and_show(){
    pH = get_pH();
    desired_pH = get_desired_pH();
    show_in_current_display(pH);
    show_in_desired_display(desired_pH);     
    error = pH - desired_pH;
}

void print_measure_and_setpoint(){
  if(!manualMode){    
    Serial.print("pH: ");
    Serial.print(pH);
    Serial.print("\t\tdesired_pH: ");
    Serial.println(desired_pH);
  }
}

void check_for_command() {
    if (Serial.available() > 0) {
        String msg = Serial.readString();
        JSONVar myObject = JSON.parse(msg);
        JSONVar Data;
        String command = "NONE";
        command = myObject["COMMAND"];
        if (command.equals("PHREAD")) {
            Data["PH"] = pH;
            Data["DESIRED_PH"] = desired_pH;
            Data["ACK"] = "DONE";
            Data["MSG"] = msg;
        } else if (command.equals("PHUP")) {
            int dropTime = myObject["DROP_TIME"];
            pH_up(dropTime);
            Data["MSG"] = msg;
            Data["ACK"] = "DONE";
        } else if (command.equals("PHDOWN")) {
            int dropTime = myObject["DROP_TIME"];
            pH_down(dropTime);
            Data["MSG"] = msg;
            Data["ACK"] = "DONE";
        } else if (command.equals("AUTO")) {
            manualMode = false;
            Data["MSG"] = msg;
            Data["ACK"] = "DONE";
        } else if (command.equals("MANUAL")) {
            manualMode = true;
            Data["MSG"] = msg;
            Data["ACK"] = "DONE";
        } else if (command.equals("SET_PH")) {            
            desired_pH_cmd = (double) myObject["VALUE"];
            desired_pH_to_eeprom(desired_pH_cmd);
            EEPROM.write(DESIRED_PH_FLAG_ADDRESS,1);
            desired_pH_from_cmd = true;
            Data["MSG"] = msg;
            Data["ACK"] = "DONE";
        } else if (command.equals("DESIRED_SOURCE")) {               
            String cmd_or_pot ="";
            cmd_or_pot = myObject["VALUE"];
            if(cmd_or_pot.equals("CMD") && !desired_pH_from_cmd)
              EEPROM.write(DESIRED_PH_FLAG_ADDRESS,1);    
            else if(!cmd_or_pot.equals("CMD") && desired_pH_from_cmd)
              EEPROM.write(DESIRED_PH_FLAG_ADDRESS,0);  
                
            desired_pH_from_cmd = cmd_or_pot.equals("CMD");
            Data["FROM_CMD"] = desired_pH_from_cmd;
            Data["MSG"] = msg;
            Data["ACK"] = "DONE";
        }
        else {
            Data["ACK"] = "ERROR";
            Data["MSG"] = msg;
        }

        Serial.println(JSON.stringify(Data));
    }
}

//----------------------//

//---- SENSORS SECTION  ---------//
float get_desired_pH() {
    if(desired_pH_from_cmd)
        return desired_pH_cmd;
    else
        return map(analogRead(POT_PIN), 0, 1023, 50, 70) / 10.0;
}


float get_pH() {
    if (pH_Serial.available() > 0) {
        char inchar = (char)pH_Serial.read();
        sensorstring += inchar;

        if (inchar == '\r') {
            ph_total = ph_total + sensorstring.toFloat();
            ph_counter++;
            sensorstring = "";
        }
    }

    if (ph_counter >= max_samples) {
        ph_current = ph_total / ph_counter;
        ph_total = 0;
        ph_counter = 0;
    }

    return ph_current;
}

void pH_up(int dropTime) {
    analogWrite(M_PH_DN, ZERO_SPEED);
    analogWrite(M_PH_UP, M_PH_UP_SPEED);
    delay(dropTime);
    analogWrite(M_PH_UP, ZERO_SPEED);
}

void pH_down(int dropTime) {
    analogWrite(M_PH_UP, ZERO_SPEED);
    analogWrite(M_PH_DN, M_PH_DN_SPEED);
    delay(dropTime);
    analogWrite(M_PH_DN, ZERO_SPEED);
}
//----------------------//

//---- DISPLAYS  ---------//
void show_in_desired_display(float ph) {
    int phWithoutDecimals = ph * 10;

    int firstDigit = phWithoutDecimals / 10;
    int secondDigit = phWithoutDecimals % 10;

    uint8_t numberToPrint[] = {firstDisplay[firstDigit], secondDisplay[secondDigit]};
    desired_display.setAll(numberToPrint);
}

void show_in_current_display(float ph) {
    int phWithoutDecimals = ph * 10;

    int firstDigit = phWithoutDecimals / 10;
    int secondDigit = phWithoutDecimals % 10;

    uint8_t numberToPrint[] = {firstDisplay[firstDigit], secondDisplay[secondDigit]};
    current_display.setAll(numberToPrint);
}
