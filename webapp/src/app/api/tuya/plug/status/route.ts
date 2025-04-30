import { NextRequest, NextResponse } from "next/server";
import { deviceId, getDeviceStatus } from "@/lib/tuya-api"; // Adjust path as needed

// --- API Route Handler ---

export async function GET(request: NextRequest) {
  if (!deviceId) {
    return NextResponse.json(
      {
        success: false,
        message: "TUYA_DEVICE_ID is not configured on the server.",
      },
      { status: 500 }
    );
  }

  try {
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
            message: `Status code 'switch_1' not found for device ${deviceId}.`,
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
