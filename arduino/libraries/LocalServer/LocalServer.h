#ifndef LOCAL_SERVER_MANAGEMENT
#define LOCAL_SERVER_MANAGEMENT
#define LOCAL_SERVER_PORT 80

#include <Arduino.h>
#include <ESPAsyncWebServer.h>
#include <ESP8266WiFi.h>
#include <Control.h>

namespace LocalServer
{
    AsyncWebServer *server;
    FileManager *fileManager;
    Control *phControl;
    Control *ecControl;

    static String processor(const String &var)
    {
        if (var == "WIFI_SSID")
        {
            return "customSSID";
        }
        else if (var == "WIFI_PASSWORD")
        {
            return "customPassword";
        }
        else if (var == "PH_SETPOINT")
        {
            return String(phControl->setpoint);
        }
        else if (var == "EC_SETPOINT")
        {
            return String(ecControl->setpoint);
        }
        else if (var == "PH_READING")
        {
            return String(phControl->current);
        }
        else if (var == "EC_READING")
        {
            return String(ecControl->current);
        }
        return String();
    }

    static void notFound(AsyncWebServerRequest *request)
    {
        request->send(404, "text/plain", "Not found");
    }

    static void saveWifiForm(AsyncWebServerRequest *request)
    {
        String responseMessage = "Error: No data received";
        String ssid;
        String password;
        if (request->hasParam("WIFI_SSID"))
        {
            ssid = request->getParam("WIFI_SSID")->value();
        }

        if (request->hasParam("WIFI_PASSWORD"))
        {
            password = request->getParam("WIFI_PASSWORD")->value();
        }

        if (ssid != NULL && password != NULL)
        {
            WiFi.begin(ssid, password);
            responseMessage = "Wifi credentials saved";
        }
        request->send(200, "text/text", responseMessage);
    }

    static void indexTemplate(AsyncWebServerRequest *request)
    {
        String fileContent = fileManager->readFile("/localwebapp/index.html");
        Serial.println(fileContent);
        request->send_P(200, "text/html", fileContent.c_str(), processor);
    }

    void initLocalServer()
    {      
        server = new AsyncWebServer(LOCAL_SERVER_PORT);
        server->on("/", HTTP_GET, indexTemplate);
        server->on("/saveWifiForm", HTTP_GET, saveWifiForm);
        server->onNotFound(notFound);
        server->begin();
    }

};

#endif
