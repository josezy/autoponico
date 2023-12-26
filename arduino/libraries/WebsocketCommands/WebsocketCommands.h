#ifndef WebsocketCommands_h
#define WebsocketCommands_h
#define MAX_CMDS 10
#include <ESP8266WiFi.h>
#include <ArduinoWebsockets.h>
#include <functional>

typedef void (*CommandHanndler)();

enum WebsocketState
{
    WS_DISCONNECTED,
    WS_CONNECTING,
    WS_CONNECTED
};

using namespace websockets;
using namespace std::placeholders;
struct CommandStruct
{
    const char *cmd;
    CommandHanndler handler;
    void *data;
};
class WebsocketCommands
{

private:
    char *socketUrl;
    WebsocketState websocketState = WS_DISCONNECTED;
    CommandStruct m_commands[MAX_CMDS];
    WebsocketsClient webSocketClient;
    void onEventsCallback(WebsocketsEvent event, String data);
    void onMessageCallback(WebsocketsMessage message);

public:
    WebsocketCommands()
    {
        memset(this->m_commands, 0, sizeof(this->m_commands));
    };
    void setSocketUrl(char *socketUrl);
    void websocketJob();
    void init();
    bool registerCmd(const char *cmd, CommandHanndler handler, void *data = NULL);
    void send(char *message);
};

#endif