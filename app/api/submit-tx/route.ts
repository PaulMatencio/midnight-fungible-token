import { NextResponse } from 'next/server';
import WebSocket from 'ws';

export const dynamic = 'force-dynamic';

/**
 * Submits an extrinsic to Midnight node via WebSocket RPC.
 * This completely avoids HTTP proxy/WAF body size limits (e.g. 403 Forbidden on payloads > 8KB).
 */
function submitViaWebSocket(
  wsUrl: string,
  extrinsicHex: string,
  timeoutMs = 20000
): Promise<{ result?: string; error?: any }> {
  return new Promise((resolve, reject) => {
    let timer: NodeJS.Timeout | null = null;
    let ws: WebSocket | null = null;

    try {
      ws = new WebSocket(wsUrl);
    } catch (err) {
      return reject(err);
    }

    timer = setTimeout(() => {
      if (ws) {
        try {
          ws.close();
        } catch {}
      }
      reject(new Error(`WebSocket submission timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    ws.on('open', () => {
      try {
        ws!.send(
          JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'author_submitExtrinsic',
            params: [extrinsicHex],
          })
        );
      } catch (err) {
        if (timer) clearTimeout(timer);
        reject(err);
      }
    });

    ws.on('message', (data: WebSocket.RawData) => {
      if (timer) clearTimeout(timer);
      try {
        ws?.close();
      } catch {}
      try {
        const json = JSON.parse(data.toString());
        resolve(json);
      } catch (err) {
        reject(err);
      }
    });

    ws.on('error', (err: Error) => {
      if (timer) clearTimeout(timer);
      reject(err);
    });
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { txHex, nodeUrl } = body;

    if (!txHex || typeof txHex !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid txHex parameter' },
        { status: 400 }
      );
    }

    const cleanHex = txHex.replace(/^0x/, '');
    if (cleanHex.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Empty transaction hex payload provided' },
        { status: 400 }
      );
    }

    const withPrefixHex = `0x${cleanHex}`;
    const targetNodeUrl =
      nodeUrl || process.env.NEXT_PUBLIC_MIDNIGHT_NODE_URL || 'https://rpc.preprod.midnight.network';

    console.log(
      '[api/submit-tx] Submitting extrinsic to node RPC:',
      targetNodeUrl,
      'payload length:',
      withPrefixHex.length
    );

    // 1. First attempt: WebSocket RPC
    // Polkadot/Substrate nodes natively stream extrinsics over WebSocket without HTTP 8KB limits
    const wsUrl = targetNodeUrl
      .replace(/^http:\/\//, 'ws://')
      .replace(/^https:\/\//, 'wss://');

    try {
      console.log('[api/submit-tx] Attempting submission via WebSocket to:', wsUrl);
      const wsResponse = await submitViaWebSocket(wsUrl, withPrefixHex);

      if (wsResponse.result) {
        console.log('[api/submit-tx] WebSocket accepted transaction. Hash:', wsResponse.result);
        return NextResponse.json({
          success: true,
          txId: wsResponse.result,
        });
      }

      if (wsResponse.error) {
        console.error('[api/submit-tx] WebSocket node RPC error:', wsResponse.error);
        return NextResponse.json(
          {
            success: false,
            error: wsResponse.error.message || 'Transaction rejected by Midnight Node',
            code: wsResponse.error.code,
            details: wsResponse.error.data,
          },
          { status: 400 }
        );
      }
    } catch (wsErr: any) {
      console.warn(
        '[api/submit-tx] WebSocket submission failed or timed out, falling back to HTTP POST:',
        wsErr?.message || wsErr
      );
    }

    // 2. Second attempt: HTTP POST RPC (fallback for local devnet or non-TLS environments)
    const rpcRes = await fetch(targetNodeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'author_submitExtrinsic',
        params: [withPrefixHex],
      }),
    });

    if (!rpcRes.ok) {
      const text = await rpcRes.text();
      return NextResponse.json(
        { success: false, error: `Node HTTP ${rpcRes.status}: ${text}` },
        { status: rpcRes.status }
      );
    }

    const rpcJson = await rpcRes.json();

    if (rpcJson.result) {
      console.log('[api/submit-tx] HTTP node accepted transaction. Hash:', rpcJson.result);
      return NextResponse.json({
        success: true,
        txId: rpcJson.result,
      });
    }

    if (rpcJson.error) {
      console.error('[api/submit-tx] HTTP Node RPC error:', rpcJson.error);
      return NextResponse.json(
        {
          success: false,
          error: rpcJson.error.message || 'Transaction rejected by Midnight Node',
          code: rpcJson.error.code,
          details: rpcJson.error.data,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Unrecognized node response format', raw: rpcJson },
      { status: 500 }
    );
  } catch (err: any) {
    console.error('[api/submit-tx] Server error submitting transaction:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error while submitting transaction' },
      { status: 500 }
    );
  }
}
