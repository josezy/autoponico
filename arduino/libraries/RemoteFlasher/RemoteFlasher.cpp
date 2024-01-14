#include "RemoteFlasher.h"

RemoteFlasher::RemoteFlasher(const char *host, const char *path, const unsigned short port)
{
    this->host = host;
    this->path = path;
    this->port = port;
}

void RemoteFlahser::pullSketchAndFlash()
{
    HttpClient client(WiFi,
                      this->host,
                      this->port);

    // Make the GET request
    client.get(this->path);

    int statusCode = client.responseStatusCode();
    // Serial.print("Update status code: ");
    // Serial.println(statusCode);
    if (statusCode != 200)
    {
        client.stop();
        return;
    }

    long length = client.contentLength();
    if (length == HttpClient::kNoContentLengthHeader)
    {
        client.stop();
        // Serial.println("Server didn't provide Content-length header. Can't continue with update.");
        return;
    }
    // Serial.print("Server returned update file of size ");
    // Serial.print(length);
    // Serial.println(" bytes");

    if (!InternalStorage.open(length))
    {
        client.stop();
        // Serial.println("There is not enough space to store the update. Can't continue with update.");
        return;
    }
    byte b;
    while (length > 0)
    {
        if (!client.readBytes(&b, 1)) // reading a byte with timeout
            break;
        InternalStorage.write(b);
        length--;
    }
    InternalStorage.close();
    client.stop();
    if (length > 0)
    {
        // Serial.print("Timeout downloading update file at ");
        // Serial.print(length);
        // Serial.println(" bytes. Can't continue with update.");
        return;
    }

    // Serial.println("Sketch update apply and reset.");
    // Serial.flush();
    InternalStorage.apply(); // this doesn't return
}
