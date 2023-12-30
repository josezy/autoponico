#include "WebsocketCommands.h"

bool WebsocketCommands::registerCmd(char* command, CommandHanndler handler, char* message) {
    for (int i = 0; i < MAX_CMDS; i++) {
        if (!m_commands[i].command) {
            m_commands[i].command = command;
            m_commands[i].handler = handler;
            m_commands[i].message = message;
            return true;
        }
    }
    return false;
}

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
    String inputString = message.data();
    int spaceIndex = inputString.indexOf(' ');

    String command;
    String data;

    if (spaceIndex != -1) {
        command = inputString.substring(0, spaceIndex);
        data = inputString.substring(spaceIndex + 1);
    } else {
        command = inputString;
        data = "";
    }

    for (int i = 0; i < MAX_CMDS; i++) {
        if (!m_commands[i].command) {
            continue;
        }
        if (String(m_commands[i].command) == command) {
            m_commands[i].handler((char*)data.c_str());
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
            delay(1000);
        }
    } else if (this->websocketState == WS_CONNECTED) {
        this->wsClient.poll();
    }

    if (WiFi.waitForConnectResult() != WL_CONNECTED) {
        this->websocketState = WS_DISCONNECTED;
        Serial.println("Websocket disconnected");
    }
}

void WebsocketCommands::init(char* socketUrl) {
    this->socketUrl = socketUrl;
    this->wsClient.onEvent(std::bind(&WebsocketCommands::onEventsCallback, this, std::placeholders::_1, std::placeholders::_2));
    this->wsClient.onMessage(std::bind(&WebsocketCommands::onMessageCallback, this, std::placeholders::_1));
    this->wsClient.setInsecure();  // FIXME: use secure connection
}

void WebsocketCommands::send(char* message) {
    this->wsClient.send(message);
}