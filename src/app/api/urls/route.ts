import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { nanoid } from 'nanoid';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { originalUrl } = await request.json();

    if (!originalUrl) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Generate a short URL
    const shortUrl = nanoid(8); // 8 characters long
    const urlId = nanoid();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO urls (id, original_url, short_url, user_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(urlId, originalUrl, shortUrl, session.user.id, now, now);

    const url = db.prepare('SELECT * FROM urls WHERE id = ?').get(urlId);

    return NextResponse.json(url);
  } catch (err) {
    console.error('URL creation error:', err);
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { id, originalUrl } = await req.json();
    if (!id || !originalUrl) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify URL ownership
    const db = await openDb();
    const url = await db.get(
      'SELECT * FROM urls WHERE id = ? AND user_email = ?',
      [id, session.user.email]
    );

    if (!url) {
      return new Response(JSON.stringify({ error: 'URL not found or unauthorized' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Update URL
    await db.run(
      'UPDATE urls SET original_url = ?, updated_at = datetime("now") WHERE id = ?',
      [originalUrl, id]
    );

    const updatedUrl = await db.get('SELECT * FROM urls WHERE id = ?', [id]);
    return new Response(JSON.stringify(updatedUrl), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error updating URL:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing URL ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify URL ownership
    const db = await openDb();
    const url = await db.get(
      'SELECT * FROM urls WHERE id = ? AND user_email = ?',
      [id, session.user.email]
    );

    if (!url) {
      return new Response(JSON.stringify({ error: 'URL not found or unauthorized' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Delete URL
    await db.run('DELETE FROM urls WHERE id = ?', [id]);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error deleting URL:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const urls = db.prepare(`
      SELECT * FROM urls 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `).all(session.user.id);

    return NextResponse.json(urls);
  } catch (err) {
    console.error('URL fetch error:', err);
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    );
  }
} 