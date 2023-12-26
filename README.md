# Autoponico


## Arduino
Software running on an ESP8266 to report measurements taken from atlas sensors
it pushes collected measurements to an InfluxDB bucket

### Get started
Install the [Arduino IDE](https://www.arduino.cc/en/software)
Copy the all libraries from `/libraries` to your Arduino's library location, usually at `~/Documents/Arduino/libraries`
`cp -R ./libraries/* ~/Documents/Arduino/libraries`

Open the `.ino` file with Arduino IDE, compile and happy upload :fire:

## WebSocket server
NodeJS program using typescript to handle websockets between webapp and Arduino boards

## Web App
NextJS bootstraped app, check `webapp/README.md` for more info
