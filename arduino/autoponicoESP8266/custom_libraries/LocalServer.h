#ifndef LOCAL_SERVER_MANAGEMENT
#define LOCAL_SERVER_MANAGEMENT
#define LOCAL_SERVER_PORT 80

#include <Arduino.h>
#include <Control.h>
#include <ESP8266WiFi.h>
#include <ESPAsyncWebServer.h>


const INDEX_TEMPLATE = "/localwebapp/index.html";
const INDEX_CSS = "/localwebapp/index.css";
const INDEX_JS = "/localwebapp/index.js";

const char *LOCAL_WEBSITE_PATH_FILES[] = {
    INDEX_TEMPLATE,
    INDEX_CSS,
    INDEX_JS,
};

namespace LocalServer {
AsyncWebServer *server;
FileManager *fileManager;
Control *phControl;
Control *ecControl;

static String processor(const String &var) {
    return String();
}

static void notFound(AsyncWebServerRequest *request) {
    request->send(404, "text/plain", "Not found");
}

static void updateWifi(AsyncWebServerRequest *request) {
    String responseMessage = "Error: No data received";
    String ssid;
    String password;
    if (request->hasParam("WIFI_SSID")) {
        ssid = request->getParam("WIFI_SSID")->value();
    }

    if (request->hasParam("WIFI_PASSWORD")) {
        password = request->getParam("WIFI_PASSWORD")->value();
    }

    if (ssid != NULL && password != NULL) {
        WiFi.begin(ssid, password);
        responseMessage = "Wifi credentials saved";
    }
    request->send(200, "text/text", responseMessage);
}

static void indexTemplate(AsyncWebServerRequest *request) {
    String fileContent = fileManager->readFile(INDEX_TEMPLATE);
    request->send_P(200, "text/html", fileContent.c_str(), processor);
}

static void jsFile(AsyncWebServerRequest *request) {
    String fileContent = fileManager->readFile(INDEX_JS);
    request->send_P(200, "text/js", fileContent.c_str());
}

static void cssFile(AsyncWebServerRequest *request) {
    String fileContent = fileManager->readFile(INDEX_CSS);
    request->send_P(200, "text/css", fileContent.c_str());
}

static void readSensorData(AsyncWebServerRequest *request) {
    String response = "{";
    response += "\"PH_READING\": " + String(phControl->current) + ",";
    response += "\"EC_READING\": " + String(ecControl->current);
    response += "}";
    request->send(200, "application/json", response);
}

static void readConfig(AsyncWebServerRequest *request) {
    String response = "{";
    response += "\"PH_SETPOINT\": " + String(phControl->setpoint) + ",";
    response += "\"PH_READING\": " + String(phControl->current) + ",";
    response += "\"EC_SETPOINT\": " + String(ecControl->setpoint) + ",";
    response += "\"EC_READING\": " + String(ecControl->current);
    response += "}";
    request->send(200, "application/json", response);
}

static voir updateSetpoints(AsyncWebServerRequest *request) {
    String responseMessage = "Error: No data received";
    String phSetpoint;
    String ecSetpoint;
    if (request->hasParam("PH_SETPOINT")) {
        phControl->setpoint = request->getParam("PH_SETPOINT")->value();
        responseMessage = "PH setpoint updated ";
    }

    if (request->hasParam("EC_SETPOINT")) {
        ecControl->setpoint = request->getParam("EC_SETPOINT")->value();
        responseMessage = responseMessage + "EC setpoint updated";
    }

    request->send(200, "text/text", responseMessage);
}


void initLocalServer() {
    server = new AsyncWebServer(LOCAL_SERVER_PORT);
    // Template, CSS and JS files
    server->on("/", HTTP_GET, indexTemplate);
    server->on("/index.js", HTTP_GET, jsFile);
    server->on("/index.css", HTTP_GET, cssFile);
    // API
    server->on("/readSensorData", HTTP_GET, readSensorData);
    server->on("/readConfig", HTTP_GET, readConfig);
    server->on("/updateWifi", HTTP_GET, updateWifi);
    server->on("/updateSetpoints", HTTP_GET, updateSetpoints);
    server->onNotFound(notFound);
    server->begin();
}

};  // namespace LocalServer

#endif
