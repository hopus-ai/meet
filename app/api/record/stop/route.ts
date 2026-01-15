import { EgressClient, EgressStatus } from '@/lib/livekit-egress';
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

    const { LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL } = process.env;

    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
      return new NextResponse('LiveKit configuration missing', { status: 500 });
    }

    const egressClient = new EgressClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

    // Verify recording permission
    const hasPermission = await egressClient.checkRecordingPermission(roomName, identity);
    if (!hasPermission) {
      return new NextResponse('Recording permission denied', { status: 403 });
    }

    // Get active egress sessions for the room
    const egresses = await egressClient.listEgress({ roomName });
    const activeEgresses = egresses.filter(
      (info) => info.status === EgressStatus.EGRESS_STARTING || info.status === EgressStatus.EGRESS_ACTIVE
    );

    if (activeEgresses.length === 0) {
      return new NextResponse('No active recording found', { status: 404 });
    }

    // Stop all active egress sessions
    const results = await Promise.all(
      activeEgresses.map((info) => egressClient.stopEgress(info.egressId))
    );

    return new NextResponse(
      JSON.stringify({
        message: 'Recording stopped',
        stopped: results.length,
        files: results.map((r) => r.fileResults).flat().filter(Boolean),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error stopping recording:', error);
    if (error instanceof Error) {
      return new NextResponse(error.message, { status: 500 });
    }
    return new NextResponse('Unknown error', { status: 500 });
  }
}
