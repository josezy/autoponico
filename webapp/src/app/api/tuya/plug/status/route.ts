import { NextRequest, NextResponse } from "next/server";
import { getDeviceStatus, getDeviceId, DeviceKey, DEVICES } from "@/lib/tuya-api";

// --- API Route Handler ---

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const deviceKey = searchParams.get('device') as DeviceKey;

  if (!deviceKey || !(deviceKey in DEVICES)) {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid or missing device key. Valid devices: " + Object.keys(DEVICES).join(', '),
      },
      { status: 400 }
    );
  }

  try {
    const deviceId = getDeviceId(deviceKey);
    const result = await getDeviceStatus(deviceId);

    if (result.success && result.result) {
      // Find the status code for the switch (assuming 'switch_1')
      const switchStatus = result.result.find(
        (status: { code: string; value: any }) => status.code === "switch_1"
      );

      if (switchStatus) {
        return NextResponse.json({ success: true, isOn: switchStatus.value });
      } else {
        // If 'switch_1' isn't found, maybe the device doesn't have it or uses a different code
        return NextResponse.json(
          {
            success: false,
            message: `Status code 'switch_1' not found for device ${deviceKey} (${deviceId}).`,
            details: result.result,
          },
          { status: 404 }
        );
      }
    } else {
      console.error("Tuya API status error:", result);
      return NextResponse.json(
        {
          success: false,
          message: "Failed to get status via Tuya API",
          error: result.msg || "Unknown Tuya error",
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("API Error getting status:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
