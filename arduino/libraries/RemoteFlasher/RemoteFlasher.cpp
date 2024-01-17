#include "RemoteFlasher.h"

RemoteFlasher::RemoteFlasher(const char *host, const char *path)
{
    this->host = host;
    this->path = path;
}

char *RemoteFlasher::pullSketchAndFlash()
{
    Serial.println("Pulling sketch from remote server...");
    HTTPClient http;
    WiFiClient wifiClient = http.getStream();

    char thisurl[255];
    // Form url
    strcpy(thisurl, this->host);
    strcat(thisurl, "/");
    strcat(thisurl, this->path);
    // Begin HTTP request
    http.begin(wifiClient, thisurl);

    // Check HTTP status
    int httpCode = http.GET();
    if (httpCode == HTTP_CODE_OK)
    {
        // Get the length of the response
        int contentLength = http.getSize();

        // Buffer to store chunks of the response
        uint8_t buffer[1024];
        const unsigned int bufferSize = sizeof(buffer);

        if (!InternalStorage.open(contentLength))
        {
            http.end();
            return "There is not enough space to store the update. Can't continue with update.";
        }

        while (contentLength > 0)
        {
            int chunckSize = wifiClient.readBytes(buffer, bufferSize);
            for (int i = 0; i < chunckSize; i++)
            {
                InternalStorage.write(buffer[i]);
            }
            contentLength = contentLength - chunckSize;
            if (chunckSize == 0)
            {
                return "Timeout downloading update file. Can't continue with update.";
            }
        }

        InternalStorage.close();
        http.end();

        if (contentLength == 0)
        {
            InternalStorage.apply(); // this doesn't return
        }

        return "Update file downloaded successfully.";
    }
    else
    {
        http.end();
        return "Error downloading update file. Can't continue with update.";
    }
}
