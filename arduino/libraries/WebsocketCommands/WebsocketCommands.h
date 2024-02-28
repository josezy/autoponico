#ifndef WebsocketCommands_h
#define WebsocketCommands_h
#define MAX_CMDS 10
#include <ArduinoWebsockets.h>
#include <ESP8266WiFi.h>

#include <functional>

#define WS_PING_INTERVAL 10000

typedef void (*CommandHandler)(const char*, const char*);

enum WebsocketState {
    WS_STATE_DISCONNECTED,
    WS_STATE_CONNECTED
};

using namespace websockets;
using namespace std::placeholders;
struct CommandStruct {
    const char* command;
    CommandHandler handler;
    const char* message;
};

class WebsocketCommands {
   private:
    String socketUrl;
    WebsocketState websocketState = WS_STATE_DISCONNECTED;
    CommandStruct m_commands[MAX_CMDS];
    WebsocketsClient wsClient;
    unsigned long lastPing = 0;
    void onEventsCallback(WebsocketsEvent event, String data);
    void onMessageCallback(WebsocketsMessage message);

   public:
    WebsocketCommands() {
        memset(this->m_commands, 0, sizeof(this->m_commands));
    };
    void websocketJob();
    void init(String socketUrl);
    bool registerCmd(char* command, CommandHandler handler, char* message = NULL);
    void send(char* message);
};

#endif