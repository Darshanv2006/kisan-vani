import { NextResponse } from 'next/server';
import { SipClient, AgentDispatchClient } from 'livekit-server-sdk';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const to = body.to || 'shivu';

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrlRaw = process.env.LIVEKIT_URL || '';
    const sipTrunkId = body.trunkId || process.env.LIVEKIT_SIP_OUTBOUND_TRUNK_ID || 'ST_6YA7VvR5NQPt';

    if (!apiKey || !apiSecret || !livekitUrlRaw) {
      return NextResponse.json(
        { error: 'LiveKit environment variables (LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET) are missing on the server' },
        { status: 500 }
      );
    }

    // Convert wss:// to https:// for REST API calls
    const httpUrl = livekitUrlRaw.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://');

    const sipAddress = to.replace('sip:', '').split('@')[0].trim();
    const roomName = `kisan-vani-outbound-${sipAddress}-${Date.now()}`;

    // 1. Dispatch agent to room
    try {
      const dispatchClient = new AgentDispatchClient(httpUrl, apiKey, apiSecret);
      await dispatchClient.createDispatch(roomName, 'my-agent');
    } catch (e: any) {
      console.warn('Agent dispatch notice:', e?.message || e);
    }

    // 2. Create SIP participant (dial Linphone softphone)
    const sipClient = new SipClient(httpUrl, apiKey, apiSecret);
    const participant = await sipClient.createSipParticipant(sipTrunkId, sipAddress, roomName, {
      fromNumber: sipAddress,
      participantIdentity: `farmer-${sipAddress}`,
      participantName: 'Farmer (Linphone)',
      playDialtone: true,
    });

    return NextResponse.json({
      success: true,
      message: `Calling Linphone user "${sipAddress}"...`,
      roomName,
      sipCallId: participant.sipCallId,
    });
  } catch (error: any) {
    console.error('SIP Call API error:', error);
    return NextResponse.json(
      {
        error: error?.message || 'Failed to initiate SIP call. Ensure LIVEKIT_SIP_OUTBOUND_TRUNK_ID is configured in LiveKit Cloud.',
      },
      { status: 500 }
    );
  }
}
