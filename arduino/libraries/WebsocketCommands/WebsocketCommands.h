#ifndef WebsocketCommands_h
#define WebsocketCommands_h
#define MAX_CMDS 10
#include <ArduinoWebsockets.h>
#include <ESP8266WiFi.h>

#include <functional>

#define WS_PING_INTERVAL 10000

typedef void (*CommandHanndler)(char*);

enum WebsocketState {
    WS_DISCONNECTED,
    WS_CONNECTED
};

using namespace websockets;
using namespace std::placeholders;
struct CommandStruct {
    const char* command;
    CommandHanndler handler;
    const char* message;
};

class WebsocketCommands {
   private:
    char* socketUrl;
    WebsocketState websocketState = WS_DISCONNECTED;
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
    void init(char* socketUrl);
    bool registerCmd(char* command, CommandHanndler handler, char* message = NULL);
    void send(char* message);
};

#endif