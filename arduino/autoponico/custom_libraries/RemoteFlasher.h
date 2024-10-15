#ifndef RemoteFlasher_h
#define RemoteFlasher_h

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPUpdate.h>
#include <WebsocketCommands.h>

class RemoteFlasher {
   private:
    String url;
    WebsocketCommands *websocketCommands;

   public:
    RemoteFlasher(WebsocketCommands *websocketCommands) : websocketCommands(websocketCommands) {
        httpUpdate.setLedPin(LED_BUILTIN, LOW);
    }

    void updateFirmware(const String url) {
        WiFiClient client;
        String msg = "Updating firmware from ";
        msg += url;

        Serial.println(msg.c_str());

        websocketCommands->send((char *)msg.c_str());
        httpUpdate.onStart([this]() {
            String msg = "CALLBACK:  HTTP update process started";
            Serial.println(msg.c_str());
            websocketCommands->send((char *)msg.c_str());
        });

        httpUpdate.onEnd([this]() {
            String msg = "CALLBACK:  HTTP update process finished";
            Serial.println(msg.c_str());
            websocketCommands->send((char *)msg.c_str());
        });

        httpUpdate.onProgress([this](int cur, int total) {
            String msg = "CALLBACK:  HTTP update process at ";
            msg += cur;
            msg += " of ";
            msg += total;
            msg += " bytes...";
            Serial.println(msg.c_str());
            // TODO: prevent spamming this, but still send some updates
            websocketCommands->send((char *)msg.c_str());
        });

        httpUpdate.onError([this](int err) {
            String msg = "CALLBACK:  HTTP update fatal error code ";
            msg += err;
            Serial.println(msg.c_str());
            websocketCommands->send((char *)msg.c_str());
        });

        t_httpUpdate_return ret = httpUpdate.update(client, url);

        switch (ret) {
            case HTTP_UPDATE_FAILED:
                Serial.printf("HTTP_UPDATE_FAILED Error (%d): %s\n", httpUpdate.getLastError(), httpUpdate.getLastErrorString().c_str());
                websocketCommands->send((char *)httpUpdate.getLastErrorString().c_str());
                break;

            case HTTP_UPDATE_NO_UPDATES:
                Serial.println("HTTP_UPDATE_NO_UPDATES");
                websocketCommands->send((char *)"No update available");
                break;

            case HTTP_UPDATE_OK:
                Serial.println("HTTP_UPDATE_OK");
                break;
        }
    }
};

#endif