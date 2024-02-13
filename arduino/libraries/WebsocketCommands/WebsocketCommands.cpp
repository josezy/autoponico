#include "WebsocketCommands.h"

bool WebsocketCommands::registerCmd(char* command, CommandHandler handler, char* message) {
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
            this->send((char*)"Autoponico connected");
            Serial.println("WS_CONNECTED");
            break;
        case WebsocketsEvent::ConnectionClosed:
            this->websocketState = WS_DISCONNECTED;
            Serial.println("WS_DISCONNECTED");
            break;
        case WebsocketsEvent::GotPing:
            Serial.println("WS_GOT_PING");
            break;
        case WebsocketsEvent::GotPong:
            Serial.println("WS_GOT_PONG");
            break;
        default:
            Serial.println("UNKNOWN");
            break;
    }
}

void WebsocketCommands::onMessageCallback(WebsocketsMessage message) {
    String inputString = message.data();
    Serial.printf("Received: %s\n", inputString.c_str());
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
    // if no wifi, mark ws as disconnected
    wl_status_t wifiStatus = WiFi.status();
    if (wifiStatus != WL_CONNECTED) {
        this->websocketState = WS_DISCONNECTED;
        Serial.printf("No wifi: %d. Websocket disconnected\n", wifiStatus);
        delay(1000);
        return;
    }

    // if ws disconnected and connected to wifi
    if (this->websocketState == WS_DISCONNECTED) {
        Serial.print("Connecting to websocket: ");
        Serial.println(this->socketUrl);
        bool connected = this->wsClient.connect(this->socketUrl); // This is syncronous
        if (connected) {
            Serial.println("Websocket connected");
        } else {
            Serial.println("Websocket connection failed");
            delay(1000);
        }
        return;
    }

    // if ws connected and ping interval reached
    if (millis() - this->lastPing > WS_PING_INTERVAL) {
        this->wsClient.ping();
        this->lastPing = millis();
        return;
    }

    // if ws connected and available
    if (this->wsClient.available()) {
        this->wsClient.poll();
    }
}

void WebsocketCommands::init(char* socketUrl) {
    this->socketUrl = socketUrl;
    this->wsClient.onEvent(std::bind(&WebsocketCommands::onEventsCallback, this, std::placeholders::_1, std::placeholders::_2));
    this->wsClient.onMessage(std::bind(&WebsocketCommands::onMessageCallback, this, std::placeholders::_1));
    this->wsClient.setInsecure();  // FIXME: use secure connection
    this->lastPing = millis();
}

void WebsocketCommands::send(char* message) {
    this->wsClient.send(message);
}