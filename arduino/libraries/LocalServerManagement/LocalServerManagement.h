#ifndef LOCAL_SERVER_MANAGEMENT
#define LOCAL_SERVER_MANAGEMENT

#include <Arduino.h>
#include <ESPAsyncWebServer.h>
#include <ESP8266WiFi.h>

class LocalServerManagement
{
private:
    AsyncWebServer *server;
    FileManager *fileManager;

public:
    LocalServerManagement(FileManager *fileManager, int port = 80) : fileManager(fileManager)
    {
        this->server = new AsyncWebServer(port);
        this->server->on("/", HTTP_GET, std::bind(&LocalServerManagement::index, this, std::placeholders::_1));
        this->server->on("/saveWifiForm", HTTP_GET, std::bind(&LocalServerManagement::saveWifiForm, this, std::placeholders::_1));
        this->server->onNotFound(std::bind(&LocalServerManagement::notFound, this, std::placeholders::_1));
        this->server->begin();
    }

    String processor(const String &var)
    {
        if (var == "WIFI_SSID")
        {
            return "customSSID";
        }
        return String();
    }

    void index(AsyncWebServerRequest *request)
    {
        String fileContent = fileManager->readFile("/localwebapp/index.html");
        Serial.println(fileContent);
        request->send_P(200, "text/html", fileContent.c_str(),
                        std::bind(&LocalServerManagement::processor, this, std::placeholders::_1));
    }

    void notFound(AsyncWebServerRequest *request)
    {
        request->send(404, "text/plain", "Not found");
    }

    void saveWifiForm(AsyncWebServerRequest *request)
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
};

#endif
