#ifndef REMOTE_FLASHER_H
#define REMOTE_FLASHER_H

#define NO_OTA_NETWORK

#include <Arduino.h>
#include <InternalStorageESP.h> // only for InternalStorage
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>

class RemoteFlasher
{
    const char *host;
    const char *path;

public:
    RemoteFlasher(const char *host, const char *path);
    char *pullSketchAndFlash();
};

#endif