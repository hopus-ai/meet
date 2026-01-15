import { EgressClient, isEgressActive } from '@/lib/livekit-egress';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const roomName = req.nextUrl.searchParams.get('roomName');
    const identity = req.nextUrl.searchParams.get('identity');

    if (roomName === null) {
      return new NextResponse('Missing roomName parameter', { status: 403 });
    }

    if (!identity) {
      return new NextResponse('Missing identity parameter', { status: 403 });
    }

    const {
      LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET,
      LIVEKIT_URL,
      S3_KEY_ID,
      S3_KEY_SECRET,
      S3_BUCKET,
      S3_ENDPOINT,
      S3_REGION,
    } = process.env;

    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
      return new NextResponse('LiveKit configuration missing', { status: 500 });
    }

    if (!S3_KEY_ID || !S3_KEY_SECRET || !S3_BUCKET || !S3_ENDPOINT) {
      return new NextResponse('S3 storage configuration missing', { status: 500 });
    }

    const egressClient = new EgressClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

    // Verify recording permission
    const hasPermission = await egressClient.checkRecordingPermission(roomName, identity);
    if (!hasPermission) {
      return new NextResponse('Recording permission denied', { status: 403 });
    }

    // Check for existing active recordings
    const existingEgresses = await egressClient.listEgress({ roomName });
    const activeEgress = existingEgresses.find((e) => isEgressActive(e.status));

    if (activeEgress) {
      return new NextResponse('Meeting is already being recorded', { status: 409 });
    }

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filepath = `recordings/${roomName}/${timestamp}.mp4`;

    // Start room composite egress
    await egressClient.startRoomCompositeEgress(
      roomName,
      {
        file: {
          filepath,
          fileType: 'MP4',
          s3: {
            accessKey: S3_KEY_ID,
            secret: S3_KEY_SECRET,
            bucket: S3_BUCKET,
            endpoint: S3_ENDPOINT,
            region: S3_REGION || 'auto',
            forcePathStyle: true,
          },
        },
      },
      {
        layout: 'speaker',
        preset: 'H264_720P_30',
      }
    );

    return new NextResponse(JSON.stringify({ message: 'Recording started', filepath }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error starting recording:', error);
    if (error instanceof Error) {
      return new NextResponse(error.message, { status: 500 });
    }
    return new NextResponse('Unknown error', { status: 500 });
  }
}
