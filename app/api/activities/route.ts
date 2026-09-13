import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import type { ActivityItem } from '@/src/types/dapp';

const DATA_DIR = path.join(process.cwd(), 'data');
const ACTIVITIES_FILE = path.join(DATA_DIR, 'audit-activities.json');

function ensureDataFile(): ActivityItem[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(ACTIVITIES_FILE)) {
      fs.writeFileSync(ACTIVITIES_FILE, JSON.stringify([], null, 2), 'utf-8');
      return [];
    }
    const raw = fs.readFileSync(ACTIVITIES_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('[API /activities] Error reading file:', err);
    return [];
  }
}

function writeDataFile(items: ActivityItem[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    // Limit to latest 1000 items
    const trimmed = items.slice(0, 1000);
    fs.writeFileSync(ACTIVITIES_FILE, JSON.stringify(trimmed, null, 2), 'utf-8');
  } catch (err) {
    console.error('[API /activities] Error writing file:', err);
  }
}

function mergeActivities(existing: ActivityItem[], incoming: ActivityItem[]): ActivityItem[] {
  const map = new Map<string, ActivityItem>();

  // Add existing
  for (const item of existing) {
    if (item && item.id) {
      map.set(item.id, item);
    }
  }

  // Merge incoming (overwrite if status is confirmed or newer)
  for (const item of incoming) {
    if (!item || !item.id) continue;
    const prev = map.get(item.id);
    if (!prev) {
      map.set(item.id, item);
    } else {
      map.set(item.id, {
        ...prev,
        ...item,
        status: item.status === 'confirmed' ? 'confirmed' : prev.status === 'confirmed' ? 'confirmed' : item.status,
        txHash: item.txHash || prev.txHash,
        blockHeight: item.blockHeight || prev.blockHeight,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

export async function GET() {
  try {
    const items = ensureDataFile();
    return NextResponse.json({
      success: true,
      count: items.length,
      activities: items,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch activities' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const existing = ensureDataFile();

    let incomingList: ActivityItem[] = [];
    if (body.activities && Array.isArray(body.activities)) {
      incomingList = body.activities;
    } else if (body.activity && typeof body.activity === 'object') {
      incomingList = [body.activity];
    } else if (Array.isArray(body)) {
      incomingList = body;
    }

    if (incomingList.length === 0) {
      return NextResponse.json({ success: true, count: existing.length, activities: existing });
    }

    const merged = mergeActivities(existing, incomingList);
    writeDataFile(merged);

    return NextResponse.json({
      success: true,
      count: merged.length,
      activities: merged,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to save activities' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const contractAddress = searchParams.get('contractAddress');

    if (contractAddress) {
      const existing = ensureDataFile();
      const filtered = existing.filter(
        (item) => item.contractAddress?.toLowerCase() !== contractAddress.toLowerCase()
      );
      writeDataFile(filtered);
      return NextResponse.json({
        success: true,
        count: filtered.length,
        activities: filtered,
        message: `Activities for contract ${contractAddress} cleared`,
      });
    }

    writeDataFile([]);
    return NextResponse.json({
      success: true,
      count: 0,
      activities: [],
      message: 'All audit activities successfully cleared',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to clear activities' },
      { status: 500 }
    );
  }
}

