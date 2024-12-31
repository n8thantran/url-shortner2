import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { shortUrl: string } }
) {
  try {
    const url = db.prepare('SELECT * FROM urls WHERE short_url = ?').get(params.shortUrl);

    if (!url) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    // Increment click count
    db.prepare('UPDATE urls SET clicks = clicks + 1 WHERE id = ?').run(url.id);

    return NextResponse.redirect(new URL(url.original_url));
  } catch (error) {
    console.error('URL redirect error:', error);
    return NextResponse.redirect(new URL('/', request.url));
  }
} 