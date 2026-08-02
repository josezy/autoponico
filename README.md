# Autoponico


## Arduino
Software running on an ESP32 to report measurements taken from atlas sensors<br/>
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
- `influxdb`
    - `info` Get influxdb info
    - `update` Pass the entire object `{"enabled": "true", "url": "", "org": "", "bucket": "", "token": ""}`
- `kalman`
    - `info`

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

## Tasmota Device Configuration
The webapp dashboard controls Tasmota devices via MQTT. Each device must be configured to connect to the ws-server MQTT broker.

**Full flash + MQTT guide:** [agent/tasmota.md](agent/tasmota.md) (Sonoff Basic R4 / ESP32-C3; web installer at **115200** baud).

### MQTT Settings (`http://<device-ip>/mq`)
- **Host**: IP of the machine running ws-server (`rata`)
- **Port**: `1883`
- **Topic**: Must match a key in `TASMOTA_DEVICES` (`webapp/src/hooks/useMqtt.tsx`) — currently `valvula-tanque`, `main-pump`
- **Full Topic**: `%prefix%/%topic%/`

### Module Template (Sonoff Basic R4)
Device reference: [templates.blakadder.com/sonoff_BASICR4.html](https://templates.blakadder.com/sonoff_BASICR4.html)

Apply via Console (`http://<device-ip>/cs`):
```
Template {"NAME":"Sonoff Basic R4","GPIO":[0,0,0,0,224,0,544,0,0,32,0,0,0,0,0,0,0,0,0,0,0,0],"FLAG":0,"BASE":1}
Module 0
```

GPIO mapping: GPIO4 = Relay1, GPIO6 = LedLink, GPIO9 = Button1. Single relay only (no energy metering).

Timer features used by the dashboard (via MQTT):
- **TimedPower** — one-shot countdown (ON for N, then OFF)
- **PulseTime** — sticky auto-off after every ON
- **Timer1–16** — clock schedules (device NTP/time must be correct)

For other devices, find your template at [templates.blakadder.com](https://templates.blakadder.com).

## Web App
NextJS bootstraped app, check `webapp/README.md` for more info
