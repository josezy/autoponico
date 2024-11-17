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
    Serial.println("Received: " + inputString);
    int spaceIndex = inputString.indexOf(' ');

    String command = inputString;
    String action = "";
    String value = "";

    if (spaceIndex != -1) {
        command = inputString.substring(0, spaceIndex);
        String payload = inputString.substring(spaceIndex + 1);
        spaceIndex = payload.indexOf(' ');
        if (spaceIndex != -1) {
            action = payload.substring(0, spaceIndex);
            value = payload.substring(spaceIndex + 1);
        } else {
            action = payload;
        }
    } else {
        command = inputString;
    }

    for (int i = 0; i < MAX_CMDS; i++) {
        if (!m_commands[i].command) {
            continue;
        }
        if (String(m_commands[i].command) == command) {
            m_commands[i].handler(action.c_str(), value.c_str());
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
        bool connected = this->wsClient.connect(this->socketUrl);
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

const char* rootCACert = R"(-----BEGIN CERTIFICATE-----
MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw
TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh
cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4
WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu
ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY
MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK3oJHP0FDfzm54rVygc
h77ct984kIxuPOZXoHj3dcKi/vVqbvYATyjb3miGbESTtrFj/RQSa78f0uoxmyF+
0TM8ukj13Xnfs7j/EvEhmkvBioZxaUpmZmyPfjxwv60pIgbz5MDmgK7iS4+3mX6U
A5/TR5d8mUgjU+g4rk8Kb4Mu0UlXjIB0ttov0DiNewNwIRt18jA8+o+u3dpjq+sW
T8KOEUt+zwvo/7V3LvSye0rgTBIlDHCNAymg4VMk7BPZ7hm/ELNKjD+Jo2FR3qyH
B5T0Y3HsLuJvW5iB4YlcNHlsdu87kGJ55tukmi8mxdAQ4Q7e2RCOFvu396j3x+UC
B5iPNgiV5+I3lg02dZ77DnKxHZu8A/lJBdiB3QW0KtZB6awBdpUKD9jf1b0SHzUv
KBds0pjBqAlkd25HN7rOrFleaJ1/ctaJxQZBKT5ZPt0m9STJEadao0xAH0ahmbWn
OlFuhjuefXKnEgV4We0+UXgVCwOPjdAvBbI+e0ocS3MFEvzG6uBQE3xDk3SzynTn
jh8BCNAw1FtxNrQHusEwMFxIt4I7mKZ9YIqioymCzLq9gwQbooMDQaHWBfEbwrbw
qHyGO0aoSCqI3Haadr8faqU9GY/rOPNk3sgrDQoo//fb4hVC1CLQJ13hef4Y53CI
rU7m2Ys6xt0nUW7/vGT1M0NPAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIBBjAPBgNV
HRMBAf8EBTADAQH/MB0GA1UdDgQWBBR5tFnme7bl5AFzgAiIyBpY9umbbjANBgkq
hkiG9w0BAQsFAAOCAgEAVR9YqbyyqFDQDLHYGmkgJykIrGF1XIpu+ILlaS/V9lZL
ubhzEFnTIZd+50xx+7LSYK05qAvqFyFWhfFQDlnrzuBZ6brJFe+GnY+EgPbk6ZGQ
3BebYhtF8GaV0nxvwuo77x/Py9auJ/GpsMiu/X1+mvoiBOv/2X/qkSsisRcOj/KK
NFtY2PwByVS5uCbMiogziUwthDyC3+6WVwW6LLv3xLfHTjuCvjHIInNzktHCgKQ5
ORAzI4JMPJ+GslWYHb4phowim57iaztXOoJwTdwJx4nLCgdNbOhdjsnvzqvHu7Ur
TkXWStAmzOVyyghqpZXjFaH3pO3JLF+l+/+sKAIuvtd7u+Nxe5AW0wdeRlN8NwdC
jNPElpzVmbUq4JUagEiuTDkHzsxHpFKVK7q4+63SM1N95R1NbdWhscdCb+ZAJzVc
oyi3B43njTOQ5yOf+1CceWxG1bQVs5ZufpsMljq4Ui0/1lvh+wjChP4kqKOJ2qxq
4RgqsahDYVvTH9w7jXbyLeiNdd8XM2w9U/t7y0Ff/9yi0GE44Za4rF2LN9d11TPA
mRGunUHBcnWEvgJBQl9nJEiU0Zsnvgc/ubhPgXRR4Xq37Z0j4r7g1SgEEzwxA57d
emyPxgcYxn/eR44/KJ4EBs+lVDR3veyJm+kXQ99b21/+jh5Xos1AnX5iItreGCc=
-----END CERTIFICATE-----)";

void WebsocketCommands::init(String socketUrl) {
    this->socketUrl = socketUrl;

    if (socketUrl.startsWith("wss://")) {
        // NOTE: sockerUrl must specify the port
        this->wsClient.setCACert(rootCACert);
        Serial.println("Using SSL certificate verification");
    } else {
        this->wsClient.setInsecure();
        Serial.println("Warning: SSL certificate verification disabled");
    }

    this->wsClient.onEvent(std::bind(&WebsocketCommands::onEventsCallback, this, std::placeholders::_1, std::placeholders::_2));
    this->wsClient.onMessage(std::bind(&WebsocketCommands::onMessageCallback, this, std::placeholders::_1));
    this->lastPing = millis();
}

void WebsocketCommands::send(char* message) {
    this->wsClient.send(message);
}