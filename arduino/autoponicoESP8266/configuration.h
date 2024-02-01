  #define VERSION "0.4.3-cota"

#define MINUTE 1000L * 60
#define USE_PULSE_OUT  // Comment if NOT using isolation board

#define SENSOR_READING_INTERVAL 1 * MINUTE
#define INFLUXDB_SYNC_COLD_DOWN 1 * MINUTE

#define USE_PULSE_OUT // Comment if NOT using isolation board

// ENUMS
enum influxdbState
{
    INFLUXDB_DISCONNECTED,
    INFLUXDB_CONNECTING,
    INFLUXDB_CONNECTED
} influxdbState = INFLUXDB_DISCONNECTED;

#define D1 5
#define D2 4
#define D3 0
#define D4 2
#define D5 14
#define D6 12
#define D7 13
#define D8 15

const char *LOCAL_WEB_SITE_PATH_FILES[] = {
    "/localwebapp/index.html",
    "/localwebapp/index.js",
    "/localwebapp/style.css",
};
