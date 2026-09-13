import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const cwd = process.cwd();
    const configPath = path.join(cwd, 'deployment.config.json');
    const jsonPath = path.join(cwd, 'deployment.json');

    let deploymentData: Record<string, any> = {};

    // 1. Read deployment.config.json if it exists
    if (fs.existsSync(configPath)) {
      try {
        const raw = fs.readFileSync(configPath, 'utf8');
        deploymentData = JSON.parse(raw);
      } catch (err) {
        console.warn('[api/deployment] Failed parsing deployment.config.json:', err);
      }
    }

    // 2. Read deployment.json if it exists and merge/override
    if (fs.existsSync(jsonPath)) {
      try {
        const raw = fs.readFileSync(jsonPath, 'utf8');
        const parsed = JSON.parse(raw);
        deploymentData = { ...deploymentData, ...parsed };
      } catch (err) {
        console.warn('[api/deployment] Failed parsing deployment.json:', err);
      }
    }

    return NextResponse.json(
      {
        success: true,
        deployment: deploymentData,
        timestamp: Date.now(),
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to read deployment config',
      },
      { status: 500 }
    );
  }
}
