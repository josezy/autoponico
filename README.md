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
> To update from webapp, generate the `.bin` file from Arduino IDE, rsync it to the ws-server and send command `management update` from webapp, it will tell the Arduino to download that file and apply updated firmware.

#### Commands
- `ping`
- `ph`
    - `cal_low`
    - `cal_mid`
    - `cal_high`
    - `cal_clear`
    - `read_ph`
- `ec`: bypass AT commands to Atlas sensor eg: `ec R` sends `R` to sensor serial
- `control`
    - `ph_up`
    - `ph_down`
    - `ph_setpoint`
    - `ph_auto`
    - `ec_up`
    - `ec_down`
    - `ec_setpoint`
    - `ec_auto`
    - `info`
- `management`
    - `reboot`
    - `update`
    - `wifi`: Set SSID and password: `management wifi <SSID>,<password>`
    - `info`
    - `influxdb`: Get influxdb info

## WebSocket server
NodeJS program using typescript to handle websockets between webapp and Arduino boards
Move to dir `cd ./ws-server`
Install packages `yarn install`
Run with `env (cat .env | xargs) nodemon main.ts`

For production, run with `env (cat prod.env | xargs) ts-node main.ts`

> [!NOTE]
> sudo snap install --classic certbot
> sudo certbot certonly --standalone -d autoponico-ws.tucanorobotics.co
> 

## Web App
NextJS bootstraped app, check `webapp/README.md` for more info
