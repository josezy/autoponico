import { NextRequest, NextResponse } from "next/server";
import { getDeviceStatus, getAllDevices } from "@/lib/tuya-api";

// --- API Route Handler ---

export async function GET(request: NextRequest) {
  try {
    const devices = getAllDevices();

    // Fetch all device statuses in parallel
    const statusPromises = devices.map(async (device) => {
      try {
        const result = await getDeviceStatus(device.id);

        if (result.success && result.result) {
          const switchStatus = result.result.find(
            (status: { code: string; value: any }) => status.code === "switch_1"
          );

          return {
            deviceKey: device.key,
            deviceId: device.id,
            deviceName: device.name,
            success: true,
            isOn: switchStatus ? switchStatus.value : null,
            connected: true
          };
        } else {
          return {
            deviceKey: device.key,
            deviceId: device.id,
            deviceName: device.name,
            success: false,
            isOn: null,
            connected: false,
            error: result.msg || "Unknown Tuya error"
          };
        }
      } catch (error: any) {
        return {
          deviceKey: device.key,
          deviceId: device.id,
          deviceName: device.name,
          success: false,
          isOn: null,
          connected: false,
          error: error.message || "Connection error"
        };
      }
    });

    const results = await Promise.all(statusPromises);

    return NextResponse.json({
      success: true,
      devices: results,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("API Error getting all device statuses:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Internal Server Error",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}