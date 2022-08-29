# Autoponico

Software running on an Arduino Nano to report measurements taken from
atlas sensors (pH and EC), this Arduino is connected to a Raspberry who performs
another task to push collected measurements to an Influx bucket

## To develop
Install [`arduino-cli`](https://arduino.github.io/arduino-cli/0.26/installation/)
, make sure you have the board:
```fish
arduino-cli board listall
```
otherwise install them with:
```fish
arduino-cli core install arduino:avr
```

### Install required libraries with
```fish
arduino-cli lib install ShiftRegister74HC595 "Grove 4-Digit Display" Arduino_JSON
```

### Compile the code with
```fish
arduino-cli compile -b arduino:avr:nano:cpu=atmega328 --libraries ../libraries/
```

## Uploading the code
Set board and port accordingly
```fish
arduino-cli compile -b arduino:avr:nano:cpu=atmega328 -u -p /dev/ttyUSB0 --libraries ../libraries/
```
