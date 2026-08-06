import { NextResponse } from 'next/server';
import { AccessToken, type AccessTokenOptions, type VideoGrant } from 'livekit-server-sdk';

const API_KEY = process.env.LIVEKIT_API_KEY || 'APIHK26zgJLTfeH';
const API_SECRET = process.env.LIVEKIT_API_SECRET || 'CLqdYUFBf0b7k7MM1CAE3oIQhBZQXA1TkMHf9oZSdesA';
const LIVEKIT_URL = process.env.LIVEKIT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://shivu-p6k39h2q.livekit.cloud';

export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const participantName = 'Farmer';
    const participantIdentity = `kisan_farmer_${Math.floor(Math.random() * 10000)}`;
    const roomName = `kisan_vani_call_${Math.floor(Math.random() * 10000)}`;

    const at = new AccessToken(API_KEY, API_SECRET, {
      identity: participantIdentity,
      name: participantName,
      ttl: '1h',
    });

    const grant: VideoGrant = {
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
    };
    at.addGrant(grant);

    const participantToken = await at.toJwt();

    return NextResponse.json({
      serverUrl: LIVEKIT_URL,
      roomName,
      participantName,
      participantToken,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("LiveKit Token Error:", msg);
    return NextResponse.json({ error: msg || 'Token generation failed' }, { status: 500 });
  }
}
