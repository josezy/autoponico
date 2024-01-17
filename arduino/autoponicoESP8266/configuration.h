#define VERSION "0.3"

#define MINUTE 1000L * 60
#define SENSOR_READING_INTERVAL 1000

#define INFLUXDB_ENABLED false
#define INFLUXDB_SYNC_COLD_DOWN 1 * MINUTE

// ESP8266 GPIO
#define D5 14
#define D6 12
#define D7 13
#define D8 15

// Sensor's pins
#define EC_RX D7
#define EC_TX D6
#define GRAV_PH_PIN D5
#define USE_PULSE_OUT  // Comment if NOT using isolation board
#define TEMPERATURE_PIN D8

// ENUMS
enum influxdbState {
    INFLUXDB_DISCONNECTED,
    INFLUXDB_CONNECTING,
    INFLUXDB_CONNECTED
} influxdbState = INFLUXDB_DISCONNECTED;
