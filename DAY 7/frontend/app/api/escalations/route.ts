import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const escalationsPath = path.join(process.cwd(), '..', 'backend', 'escalations.json');
    if (fs.existsSync(escalationsPath)) {
      const data = fs.readFileSync(escalationsPath, 'utf-8');
      const tickets = JSON.parse(data);
      return NextResponse.json({ success: true, tickets });
    }
    return NextResponse.json({ success: true, tickets: [] });
  } catch (error) {
    console.error('Error reading escalations:', error);
    return NextResponse.json({ success: false, tickets: [], error: 'Failed loading escalation tickets' }, { status: 500 });
  }
}
