// env variables

#define WIFI_SSID "AGROTUCANO"
#define WIFI_PASSWORD "robotics"
#define AP_SSID "AUTOPONICO"
#define AP_PASSWORD "autoponico"

#define INFLUXDB_URL "https://autoponico.tucanorobotics.co/influxdb" // FIXME: point to local influxdb, set up container?
#define INFLUXDB_ORG ""
#define INFLUXDB_BUCKET ""
#define INFLUXDB_TOKEN ""

#define WEBSOCKET_URL "wss://autoponico-ws.tucanorobotics.co/ws?channel=my-channel"

#define FIRMWARE_URL "http://autoponico-ws.tucanorobotics.co/latest-firmware.bin" // requires more effort to run over https
