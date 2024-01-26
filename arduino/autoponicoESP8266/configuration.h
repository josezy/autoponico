#define VERSION "0.4.2-cota"

#define MINUTE 1000L * 60
#define SENSOR_READING_INTERVAL 1000

#define INFLUXDB_ENABLED true
#define INFLUXDB_SYNC_COLD_DOWN 1 * MINUTE

#define USE_PULSE_OUT  // Comment if NOT using isolation board

// ENUMS
enum influxdbState {
    INFLUXDB_DISCONNECTED,
    INFLUXDB_CONNECTING,
    INFLUXDB_CONNECTED
} influxdbState = INFLUXDB_DISCONNECTED;
