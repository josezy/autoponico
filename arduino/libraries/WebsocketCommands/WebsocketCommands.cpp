#include "WebsocketCommands.h"

bool WebsocketCommands::registerCmd(const char *cmd, CommandHanndler handler, void *data) {
    for (int i = 0; i < MAX_CMDS; i++) {
        if (!m_commands[i].cmd) {
            m_commands[i].cmd = cmd;
            m_commands[i].handler = handler;
            m_commands[i].data = data;
            return true;
        }
    }
    return false;
}

// FIXME: review need for this, clean up code
void WebsocketCommands::onEventsCallback(WebsocketsEvent event, String data) {
    Serial.print("Websocket event: ");

    switch (event) {
        case WebsocketsEvent::ConnectionOpened:
            this->websocketState = WS_CONNECTED;
            Serial.println("WS_CONNECTED");
            break;
        case WebsocketsEvent::ConnectionClosed:
            this->websocketState = WS_DISCONNECTED;
            Serial.println("WS_DISCONNECTED");
            break;
        case WebsocketsEvent::GotPing:
            break;
        case WebsocketsEvent::GotPong:
            break;
        default:
            break;
    }
}

void WebsocketCommands::onMessageCallback(WebsocketsMessage message) {
    String s = message.data();
    const int length = s.length();
    char *char_array = new char[length + 1];
    strcpy(char_array, s.c_str());
    char *cmd = strtok(char_array, " ");
    for (int i = 0; i < MAX_CMDS; i++) {
        if (m_commands[i].cmd && strcmp(m_commands[i].cmd, cmd) == 0) {
            m_commands[i].handler();
            break;  // FIXME: remove this break and allow multiple commands to be executed
        }
    }
}

void WebsocketCommands::websocketJob() {
    if (this->websocketState == WS_DISCONNECTED && this->websocketState != WS_CONNECTING && WiFi.waitForConnectResult() == WL_CONNECTED) {
        Serial.print("Connecting to websocket: ");
        Serial.println(this->socketUrl);
        this->websocketState = WS_CONNECTING;
        bool connected = this->wsClient.connect(this->socketUrl);
        if (connected) {
            Serial.println("Websocket connected");
        } else {
            Serial.println("Websocket connection failed");
            this->websocketState = WS_DISCONNECTED;
        }
    } else if (this->websocketState == WS_CONNECTED) {
        this->wsClient.poll();
    }

    if (WiFi.waitForConnectResult() != WL_CONNECTED) {
        this->websocketState = WS_DISCONNECTED;
        Serial.println("Websocket disconnected");
    }
}

void WebsocketCommands::init(String socketUrl) {
    this->socketUrl = socketUrl;
    this->wsClient.onEvent(std::bind(&WebsocketCommands::onEventsCallback, this, std::placeholders::_1, std::placeholders::_2));
    this->wsClient.onMessage(std::bind(&WebsocketCommands::onMessageCallback, this, std::placeholders::_1));
    this->wsClient.setInsecure();  // FIXME: use secure connection
}

void WebsocketCommands::send(char *message) {
    this->wsClient.send(message);
}