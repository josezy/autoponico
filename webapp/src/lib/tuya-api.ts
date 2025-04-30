import crypto from 'crypto';

export const clientId = process.env.TUYA_CLIENT_ID!;
export const clientSecret = process.env.TUYA_CLIENT_SECRET!;
export const apiBaseUrl = process.env.TUYA_API_URL!;
export const deviceId = process.env.TUYA_DEVICE_ID!; // Read directly from server env

// --- Tuya API Helper Functions ---

export function generateSignature(
    timestamp: string,
    method: string,
    url: string,
    body: string | null = null,
    accessToken: string | null = null
): string {
    const stringToSign = `${clientId}${accessToken || ''}${timestamp}${method}
${crypto.createHash('sha256').update(body || '').digest('hex').toLowerCase()}

${url}`;
    const sign = crypto.createHmac('sha256', clientSecret)
        .update(stringToSign)
        .digest('hex')
        .toUpperCase();
    return sign;
}

export async function getAccessToken(): Promise<string | null> {
    const method = 'GET';
    const url = '/v1.0/token?grant_type=1';
    const timestamp = Date.now().toString();
    const sign = generateSignature(timestamp, method, url);

    const headers = {
        'client_id': clientId,
        'sign': sign,
        't': timestamp,
        'sign_method': 'HMAC-SHA256',
        'Content-Type': 'application/json'
    };

    try {
        const response = await fetch(`${apiBaseUrl}${url}`, { method, headers });
        const data = await response.json();

        if (data.success) {
            // TODO: Cache the token
            return data.result.access_token;
        } else {
            console.error('Error getting Tuya access token:', data);
            return null;
        }
    } catch (error) {
        console.error('Failed to fetch Tuya access token:', error);
        return null;
    }
}

// Function to get device status
// Reference: https://developer.tuya.com/en/docs/iot/open-api/api-reference/smart-home-devices-management/device-status?id=K9gf7o5prgf7s
export async function getDeviceStatus(targetDeviceId: string): Promise<any> {
    const accessToken = await getAccessToken();
    if (!accessToken) {
        throw new Error('Failed to get access token');
    }

    const method = 'GET';
    const url = `/v1.0/devices/${targetDeviceId}/status`;
    const timestamp = Date.now().toString();
    const sign = generateSignature(timestamp, method, url, null, accessToken); // No body for GET

    const headers = {
        'client_id': clientId,
        'access_token': accessToken,
        'sign': sign,
        't': timestamp,
        'sign_method': 'HMAC-SHA256',
        'Content-Type': 'application/json'
    };

    try {
        const response = await fetch(`${apiBaseUrl}${url}`, { method, headers });
        const data = await response.json();
        console.log("data", data)
        return data;
    } catch (error) {
        console.error('Failed to fetch Tuya device status:', error);
        throw new Error('Failed to fetch status');
    }
}

// Function to send device commands
// Reference: https://developer.tuya.com/en/docs/iot/open-api/api-reference/smart-home-devices-management/device-control?id=K9gchzlskph3v
export async function sendDeviceCommand(
  targetDeviceId: string,
  commands: { code: string; value: any }[]
): Promise<any> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new Error("Failed to get access token");
  }

  const method = "POST";
  const url = `/v1.0/devices/${targetDeviceId}/commands`;
  const timestamp = Date.now().toString();
  const body = JSON.stringify({ commands });
  const sign = generateSignature(timestamp, method, url, body, accessToken);

  const headers = {
    client_id: clientId,
    access_token: accessToken,
    sign: sign,
    t: timestamp,
    sign_method: "HMAC-SHA256",
    "Content-Type": "application/json",
  };

  try {
    const response = await fetch(`${apiBaseUrl}${url}`, {
      method,
      headers,
      body,
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Failed to send Tuya device command:", error);
    throw new Error("Failed to send command");
  }
}
