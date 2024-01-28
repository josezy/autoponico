#ifndef RemoteFlasher_h
#define RemoteFlasher_h

// Arduino included libraries
#include <ESP8266WiFi.h>
#include <ESP8266httpUpdate.h>
// Install from library manager
#include <ArduinoWebsockets.h>
#include <Arduino.h>
#include <WebsocketCommands.h>

class RemoteFlasher
{
private:
  String url;
  WebsocketCommands websocketCommands;

public:
  RemoteFlasher(WebsocketCommands &websocketCommands) : websocketCommands(websocketCommands)
  {
    ESPhttpUpdate.setLedPin(LED_BUILTIN, LOW);
    ESPhttpUpdate.onStart(std::bind(&RemoteFlasher::update_started, this));
    ESPhttpUpdate.onEnd(std::bind(&RemoteFlasher::update_finished, this));
    ESPhttpUpdate.onProgress(std::bind(&RemoteFlasher::update_progress, this, _1, _2));
    ESPhttpUpdate.onError(std::bind(&RemoteFlasher::update_error, this, _1));
  }

  void updateFirmware(const String url)
  {
    WiFiClient client;
    String msg = "Updating firmware from ";
    msg += url;

    Serial.println(msg.c_str());

    websocketCommands.send((char *)msg.c_str());
    t_httpUpdate_return ret = ESPhttpUpdate.update(client, url);

    switch (ret)
    {
    case HTTP_UPDATE_FAILED:
    {
      String msg = "HTTP_UPDATE_FAILED Error: (";
      msg += ESPhttpUpdate.getLastError();
      msg += "): ";
      msg += ESPhttpUpdate.getLastErrorString();
      Serial.println(msg.c_str());
      websocketCommands.send((char *)msg.c_str());
      break;
    }
    case HTTP_UPDATE_NO_UPDATES:
    {
      Serial.println("HTTP_UPDATE_NO_UPDATES");
      websocketCommands.send((char *)"No update available");
      break;
    }
    }
  }
  void update_started()
  {
    String msg = "CALLBACK:  HTTP update process started";
    Serial.println(msg.c_str());
    websocketCommands.send((char *)msg.c_str());
  }

  void update_finished()
  {
    String msg = "CALLBACK:  HTTP update process finished";
    Serial.println(msg.c_str());
    websocketCommands.send((char *)msg.c_str());
  }

  void update_progress(int cur, int total)
  {
    String msg = "CALLBACK:  HTTP update process at ";
    msg += cur;
    msg += " of ";
    msg += total;
    msg += " bytes...";
    Serial.println(msg.c_str());
    websocketCommands.send((char *)msg.c_str());
  }

  void update_error(int err)
  {
    String msg = "CALLBACK:  HTTP update fatal error code ";
    msg += err;
    Serial.println(msg.c_str());
    websocketCommands.send((char *)msg.c_str());
  }
};

#endif