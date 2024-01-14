#ifndef REMOTE_FLASHER_H
#define REMOTE_FLASHER_H

#include <ArduinoHttpClient.h>

#define NO_OTA_NETWORK // Required?
#include <ArduinoOTA.h> // only for InternalStorage
#include <ESP8266WiFi.h>


class RemoteFlasher
{
    const char *host;
    unsigned short port = 80;
    const char *path;

public:
    RemoteFlasher(const char *host, const char *path, const unsigned short port = 80);
    void pullSketchAndFlash();
};

#endif