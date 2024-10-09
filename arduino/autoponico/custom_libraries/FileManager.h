#ifndef FILE_MANAGER_H
#define FILE_MANAGER_H

#include <Arduino.h>
#include <FS.h>
#include <LittleFS.h>
#include <WiFiClient.h>
#include <HTTPClient.h>

class FileManager {
   private:
    bool ensureDirectory(const char* path) {
        if (LittleFS.exists(path)) {
            return true;
        }
        return LittleFS.mkdir(path);
    }

   public:
    FileManager() {
        if (!LittleFS.begin(true)) {  // Format on failure
            Serial.println("An Error has occurred while mounting LittleFS");
        } else {
            Serial.println("LittleFS Mounted");
            ensureDirectory("/state");
        }
    }

    void listDir(const char *dirname) {
        Serial.printf("Listing directory: %s\n", dirname);

        File root = LittleFS.open(dirname);
        if (!root) {
            Serial.println("Failed to open directory");
            return;
        }
        if (!root.isDirectory()) {
            Serial.println("Not a directory");
            return;
        }

        File file = root.openNextFile();
        while (file) {
            if (file.isDirectory()) {
                Serial.print("  DIR : ");
                Serial.println(file.name());
            } else {
                Serial.print("  FILE: ");
                Serial.print(file.name());
                Serial.print("  SIZE: ");
                Serial.println(file.size());
            }
            file = root.openNextFile();
        }
    }

    String readFile(String path) {
        return readFile(path.c_str());
    }

    String readFile(const char *path) {
        if (!LittleFS.exists(path)) {
            return String();
        }

        File file = LittleFS.open(path, "r");
        if (!file || file.isDirectory()) {
            Serial.println("Failed to open file for reading");
            return String();
        }

        String fileContent;
        while (file.available()) {
            fileContent += (char)file.read();
        }
        file.close();
        return fileContent;
    }

    String readState(String state, String defaultValue) {
        String path = "/state/" + state;
        if (!LittleFS.exists("/state")) {
            Serial.println("State directory does not exist. Creating it.");
            if (!ensureDirectory("/state")) {
                Serial.println("Failed to create state directory");
                return defaultValue;
            }
        }
        String content = readFile(path.c_str());
        if (content.length() == 0) {
            return defaultValue;
        }
        return content;
    }

    bool writeFile(const char *path, const char *message) {
        File file = LittleFS.open(path, "w");
        if (!file) {
            Serial.printf("Failed to open file for writing: %s\n", path);
            return false;
        }
        if (file.print(message)) {
            file.close();
            Serial.printf("File written to: %s\n", path);
            return true;
        } else {
            Serial.printf("Failed to write file: %s\n", path);
            file.close();
            return false;
        }
    }

    bool writeState(const char* state, const char* value) {
        if (!ensureDirectory("/state")) {
            Serial.println("Failed to create state directory");
            return false;
        }
        String path = "/state/" + String(state);
        return writeFile(path.c_str(), value);
    }

    bool writeState(String state, String value) {
        return writeState(state.c_str(), value.c_str());
    }

    bool streamToFile(const char *host, const char *path) {
        WiFiClient wifiClient;
        HTTPClient http;

        String url = String(host) + String(path);
        http.begin(wifiClient, url);

        int httpCode = http.GET();

        if (httpCode == HTTP_CODE_OK) {
            File file = LittleFS.open(path, "w");

            if (!file) {
                Serial.println("File creation failed");
                http.end();
                return false;
            }

            int len = http.getSize();
            uint8_t buff[128] = { 0 };
            WiFiClient * stream = http.getStreamPtr();
            while (http.connected() && (len > 0 || len == -1)) {
                size_t size = stream->available();
                if (size) {
                    int c = stream->readBytes(buff, ((size > sizeof(buff)) ? sizeof(buff) : size));
                    file.write(buff, c);
                    if (len > 0) {
                        len -= c;
                    }
                }
                delay(1);
            }

            file.close();
            http.end();
            return true;
        } else {
            Serial.printf("HTTP GET failed with error: %d\n", httpCode);
            http.end();
            return false;
        }
    }

    bool deleteFile(const char *path) {
        if (!LittleFS.remove(path)) {
            Serial.printf("Failed to delete file: %s\n", path);
            return false;
        }
        return true;
    }
};

#endif