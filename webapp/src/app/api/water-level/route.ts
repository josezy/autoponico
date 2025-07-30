import { InfluxDB } from '@influxdata/influxdb-client';
import { NextRequest, NextResponse } from 'next/server';

export interface DataPoint {
  time: string;
  value: number;
  _time: Date;
}

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '-1h';

    // Server-side InfluxDB configuration
    const dataConfig = {
      url: process.env.INFLUXDB_DATA_URL || 'https://influxdb.tucanorobotics.co',
      org: process.env.INFLUXDB_DATA_ORG || '',
      bucket: process.env.INFLUXDB_DATA_BUCKET || '',
      token: process.env.INFLUXDB_DATA_TOKEN || '',
    };

    // Validate configuration
    if (!dataConfig.org || !dataConfig.bucket || !dataConfig.token) {
      return NextResponse.json(
        { error: 'InfluxDB configuration missing. Please check environment variables.' },
        { status: 500 }
      );
    }

    // Create InfluxDB client
    const influxClient = new InfluxDB({
      url: dataConfig.url,
      token: dataConfig.token,
    });

    const minDistance = 35.0;
    const maxDistance = 105.0;

    // Build Flux query
    const fluxQuery = `
      minDistance = float(v: ${minDistance})
      maxDistance = float(v: ${maxDistance})

      from(bucket: "${dataConfig.bucket}")
        |> range(start: ${timeRange})
        |> filter(fn: (r) =>
          r._measurement == "cultivo" and
          r._field == "distance" and
          r._value > 0.0 and
          r._value <= maxDistance
        )
        |> map(fn: (r) => ({
          r with
          _value: (1.0 - (float(v: r._value) - minDistance) / (maxDistance - minDistance)) * 100.0
        }))
        |> sort(columns: ["_time"])
    `;

    // Execute query
    const queryApi = influxClient.getQueryApi(dataConfig.org);
    const data: DataPoint[] = [];

    const result = await new Promise<DataPoint[]>((resolve, reject) => {
      queryApi.queryRows(fluxQuery, {
        next: (row, tableMeta) => {
          const record = tableMeta.toObject(row);
          data.push({
            time: new Date(record._time).toISOString(),
            value: parseFloat(record._value) || 0,
            _time: new Date(record._time),
          });
        },
        error: (error) => {
          console.error('InfluxDB query error:', error);
          reject(error);
        },
        complete: () => {
          resolve(data);
        },
      });
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Water level API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch water level data' },
      { status: 500 }
    );
  }
}
