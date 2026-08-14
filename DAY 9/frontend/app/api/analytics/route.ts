import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const backendDir = path.join(process.cwd(), '..', 'backend');
    const jsonPath = path.join(backendDir, 'analytics.json');

    // Refresh analytics JSON from SQLite DB
    try {
      execSync('uv run python -c "from src.db import export_analytics_json; export_analytics_json()"', {
        cwd: backendDir,
        timeout: 4000,
        stdio: 'ignore',
      });
    } catch {
      // Fallback to reading existing analytics.json
    }

    if (fs.existsSync(jsonPath)) {
      const data = fs.readFileSync(jsonPath, 'utf-8');
      const analytics = JSON.parse(data);
      return NextResponse.json(
        { success: true, ...analytics },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        total_calls: 0,
        successful_calls: 0,
        failed_calls: 0,
        success_rate: 0.0,
        failure_breakdown: {},
        query_breakdown: {},
        recent_calls: [],
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      {
        success: false,
        total_calls: 0,
        successful_calls: 0,
        failed_calls: 0,
        success_rate: 0.0,
        failure_breakdown: {},
        query_breakdown: {},
        recent_calls: [],
        error: 'Failed to load call analytics',
      },
      { status: 500 }
    );
  }
}
