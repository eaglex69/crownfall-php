import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { getUser } from '@/lib/game';

const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const MAX = 3 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const admin = await getUser();
    if (admin?.role !== 'admin') return NextResponse.json({ error: 'Доступ запрещён.' }, { status: 403 });
    const form = await req.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string') return NextResponse.json({ error: 'Файл не получен.' }, { status: 400 });
    const type = (file as File).type;
    if (!ALLOWED.has(type)) return NextResponse.json({ error: 'Допустимы только PNG, JPG, WEBP или GIF.' }, { status: 400 });
    if ((file as File).size > MAX) return NextResponse.json({ error: 'Файл слишком большой (максимум 3 МБ).' }, { status: 400 });
    const bytes = Buffer.from(await (file as File).arrayBuffer());
    const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : type === 'image/gif' ? 'gif' : 'jpg';
    const safe = String(form.get('name') || 'card').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'card';
    const dir = path.join(process.cwd(), 'public', 'images', 'uploads');
    await mkdir(dir, { recursive: true });
    const name = `${safe}-${Date.now().toString(36)}.${ext}`;
    await writeFile(path.join(dir, name), bytes);
    return NextResponse.json({ ok: true, url: `/images/uploads/${name}` });
  } catch (e) {
    console.error('upload', e);
    return NextResponse.json({ error: 'Не удалось загрузить изображение.' }, { status: 500 });
  }
}
