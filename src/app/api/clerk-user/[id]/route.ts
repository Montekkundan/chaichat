import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(params.id);
    
    return NextResponse.json({
      id: user.id,
      fullName: user.fullName,
      imageUrl: user.imageUrl,
    });
  } catch (e) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
}