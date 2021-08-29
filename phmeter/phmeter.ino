#include <ShiftRegister74HC595.h>
#include <SoftwareSerial.h>                           //we have to include the SoftwareSerial library, or else we can't use it

#define rx 2                                          //define what pin rx is going to be
#define tx 3                                          //define what pin tx is going to be

#define M_PH_UP 9
#define M_PH_DN 10
#define M_PH_UP_SPEED 130
#define M_PH_DN_SPEED 170
#define ZERO_SPEED 0

#define PH_PIN A7
#define POT_PIN A0

#define NUM_DIGITS 2

#define DESIRED_SEG7_DATA 5
#define DESIRED_SEG7_LATCH 6
#define DESIRED_SEG7_CLOCK 7

#define CURRENT_SEG7_DATA 8
#define CURRENT_SEG7_LATCH 12
#define CURRENT_SEG7_CLOCK 11

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
float pHTotal=0;
float desired_pH;
float error;


//<--- PH SENSOR --->//

String inputstring = "";                              //a string to hold incoming data from the PC
String sensorstring = "";                             //a string to hold the data from the Atlas Scientific product
boolean input_string_complete = false;                //have we received all the data from the PC
boolean sensor_string_complete = false;               //have we received all the data from the Atlas Scientific product
                                       //used to hold a floating point number that is the pH
float ph_total = 0;
float ph_current = 0;
float ph_counter  = 0;
const uint8_t max_samples = 1;
SoftwareSerial myserial(rx, tx); 

void setup() {
    pinMode(M_PH_UP, OUTPUT);
    pinMode(M_PH_DN, OUTPUT);
    pinMode(POT_PIN, INPUT);
    pinMode(PH_PIN, INPUT);
    //if the hardware serial port_0 receives a char
    inputstring = Serial.readStringUntil(13);           //read the string until we see a <CR>
    input_string_complete = true;     
      
    Serial.begin(115200);
    myserial.begin(9600);                               //set baud rate for the software serial port to 9600
    inputstring.reserve(10);                            //set aside some bytes for receiving data from the PC
    sensorstring.reserve(30);                           //set aside some bytes for receiving data from Atlas Scientific product       

}

void loop() {
  
    pH = get_pH();
    show_in_current_display(pH);
    desired_pH = get_desired_pH();
    show_in_desired_display(desired_pH);

    error = pH - desired_pH;
    Serial.print("Error: ");
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
                show_in_current_display(pH);
                desired_pH = get_desired_pH();
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
  if (myserial.available() > 0) {                     //if we see that the Atlas Scientific product has sent a character
    char inchar = (char)myserial.read();              //get the char we just received
    sensorstring += inchar;                           //add the char to the var called sensorstring
    if (inchar == '\r') {                             //if the incoming character is a <CR>
      sensor_string_complete = true;                  //set the flag
    }
  }
  
  if (sensor_string_complete == true) {               //if a string from the Atlas Scientific product has been received in its entirety
    Serial.println(sensorstring);                     //send that string to the PC's serial monitor
    ph_total =  ph_total + sensorstring.toFloat();
    
    ph_counter++;
    sensorstring = "";                                //clear the string
    sensor_string_complete = false;                   //reset the flag used to tell if we have received a completed string from the Atlas Scientific product
  }
  if(ph_counter >= max_samples ){
    ph_current = ph_total/ph_counter;
    ph_total = 0;
    ph_counter = 0;
    
  }


  return ph_current;
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
