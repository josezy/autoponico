#ifndef LOCAL_SERVER_MANAGEMENT
#define LOCAL_SERVER_MANAGEMENT

#include <Arduino.h>
#include <ESPAsyncWebServer.h>

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
        String inputMessage;
        // GET inputString value on <ESP_IP>/get?inputString=<inputMessage>
        if (request->hasParam("WIFI_SSID"))
        {
            inputMessage = request->getParam("WIFI_SSID")->value();
            this->fileManager->writeFile("/wifi/ssid.txt", inputMessage.c_str());
            Serial.println(inputMessage);
        }
        // GET inputInt value on <ESP_IP>/get?inputInt=<inputMessage>
        else if (request->hasParam("WIFI_PASSWORD"))
        {
            inputMessage = request->getParam("WIFI_PASSWORD")->value();
            this->fileManager->writeFile("/wifi/password.txt", inputMessage.c_str());
            Serial.println(inputMessage);
        }
        else
        {
            inputMessage = "No message sent";
        }
        request->send(200, "text/text", inputMessage);
    }
};

#endif
