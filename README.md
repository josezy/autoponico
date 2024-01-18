# Autoponico


## Arduino
Software running on an ESP8266 to report measurements taken from atlas sensors<br/>
it pushes collected measurements to an InfluxDB bucket

### Get started
Install the [Arduino IDE](https://www.arduino.cc/en/software)<br/>
Copy the all libraries from `/libraries` to your Arduino's library location, usually at `~/Documents/Arduino/libraries`<br/>
`cp -R ./libraries/* ~/Documents/Arduino/libraries`

or create a symlink 😏
`ln -fs /Users/<user>/autoponico/arduino/libraries /Users/<user>/Documents/Arduino/libraries`

Open the `.ino` file with Arduino IDE, compile and happy upload :fire:

> [!NOTE]  
> To upload from webapp, generate the `.bin` file from Arduino IDE and send command `management update`, it will be automatically downloaded from NextJS/vercel

## WebSocket server
NodeJS program using typescript to handle websockets between webapp and Arduino boards
Move to dir `cd ./ws-server`
Install packages `yarn install`
Run with `env (cat .env | xargs) nodemon main.ts`

For production, run with `env (cat prod.env | xargs) ts-node main.ts`

## Web App
NextJS bootstraped app, check `webapp/README.md` for more info
