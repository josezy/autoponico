#ifndef FILE_MANAGER_H
#define FILE_MANAGER_H

#include <Arduino.h>
#include <LittleFS.h>

class FileManager
{
private:
public:
    FileManager()
    {
        this->begin();
    }

    void begin()
    {
        if (!LittleFS.begin())
        {
            Serial.println("An Error has occurred while mounting LittleFS");
            return;
        }
    }

    void listDir(const char *dirname)
    {
        Serial.printf("Listing directory: %s\n", dirname);

        Dir root = LittleFS.openDir(dirname);

        while (root.next())
        {
            File file = root.openFile("r");
            Serial.print("  FILE: ");
            Serial.print(root.fileName());
            Serial.print("  SIZE: ");
            Serial.print(file.size());
            time_t cr = file.getCreationTime();
            time_t lw = file.getLastWrite();
            file.close();
            struct tm *tmstruct = localtime(&cr);
            Serial.printf("    CREATION: %d-%02d-%02d %02d:%02d:%02d\n", (tmstruct->tm_year) + 1900, (tmstruct->tm_mon) + 1, tmstruct->tm_mday, tmstruct->tm_hour, tmstruct->tm_min, tmstruct->tm_sec);
            tmstruct = localtime(&lw);
            Serial.printf("  LAST WRITE: %d-%02d-%02d %02d:%02d:%02d\n", (tmstruct->tm_year) + 1900, (tmstruct->tm_mon) + 1, tmstruct->tm_mday, tmstruct->tm_hour, tmstruct->tm_min, tmstruct->tm_sec);
        }
    }

    String readFile(const char *path)
    {
        Serial.printf("Reading file: %s\n", path);
        File file = LittleFS.open(path, "r");
        if (!file)
        {
            Serial.println("- failed to open file for reading");
            return "";
        }
        String fileContent;
        while (file.available())
        {
            fileContent += String((char)file.read());
        }
        file.close();
        return fileContent;
    }

    void writeFile(const char *path, const char *message)
    {
        Serial.printf("Writing file: %s\n", path);
        File file = LittleFS.open(path, "w");
        if (!file)
        {
            Serial.println("- failed to open file for writing");
            return;
        }
        if (file.print(message))
        {
            Serial.println("- file written");
        }
        else
        {
            Serial.println("- write failed");
        }
        file.close();
    }

    bool streamToFile(const char *host, const char *path)
    {
        WiFiClient wifiClient;
        HTTPClient http;

        String url = String(host) + String(path);
        http.begin(wifiClient, url);

        int httpCode = http.GET();

        if (httpCode == HTTP_CODE_OK)
        {
            File file = LittleFS.open(path, "w");

            if (!file)
            {
                Serial.println("File creation failed");
                return false;
            }

            WiFiClient *stream = http.getStreamPtr();
            while (stream->available())
            {
                file.write(stream->read());
            }

            file.close();
            http.end();
            return true;
        }
        else
        {
            Serial.printf("HTTP GET failed with error: %d\n", httpCode);
            return false;
        }
    }

    void deleteFile(const char *path)
    {
        Serial.printf("Deleting file: %s\n", path);
        if (LittleFS.remove(path))
        {
            Serial.println("- file deleted");
        }
        else
        {
            Serial.println("- delete failed");
        }
    }
};

#endif
