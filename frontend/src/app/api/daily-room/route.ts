import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const apiKey = process.env.DAILY_API_KEY;
    const roomName = `kisan_vani_${Math.floor(Math.random() * 100000)}`;

    if (apiKey && apiKey.trim()) {
      const res = await fetch('https://api.daily.co/v1/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          name: roomName,
          properties: {
            exp: Math.floor(Date.now() / 1000) + 3600,
            enable_chat: true,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        return NextResponse.json({ roomUrl: data.url, roomName: data.name });
      }
    }

    // Default Fallback Room URL when no API key is specified
    const domain = process.env.DAILY_DOMAIN || 'kisanvani';
    const roomUrl = `https://${domain}.daily.co/${roomName}`;

    return NextResponse.json({
      roomUrl,
      roomName,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Daily Room API Error:", msg);
    return NextResponse.json({ error: msg || 'Room creation failed' }, { status: 500 });
  }
}
