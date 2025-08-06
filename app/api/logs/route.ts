import { NextRequest } from 'next/server';

// Store logs in memory (in production, use proper logging service)
const logs: string[] = [];

export const maxDuration = 60; // For streaming

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  if (action === 'stream') {
    // Server-Sent Events for real-time log streaming
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      start(controller) {
        // Send existing logs
        logs.slice(-50).forEach(log => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ log, timestamp: new Date().toISOString() })}\n\n`));
        });

        // Keep connection alive and send new logs
        const interval = setInterval(() => {
          if (logs.length > 0) {
            const latestLog = logs[logs.length - 1];
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ log: latestLog, timestamp: new Date().toISOString() })}\n\n`));
          }
        }, 1000);

        // Cleanup after 60 seconds
        setTimeout(() => {
          clearInterval(interval);
          controller.close();
        }, 60000);
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }

  // Return recent logs as JSON
  return Response.json({ 
    logs: logs.slice(-100),
    count: logs.length 
  });
}

export async function POST(request: NextRequest) {
  const { message, level = 'info' } = await request.json();
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  
  logs.push(logEntry);
  
  // Keep only last 1000 logs to prevent memory issues
  if (logs.length > 1000) {
    logs.splice(0, logs.length - 1000);
  }
  
  return Response.json({ success: true });
}