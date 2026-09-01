import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/auth/signup - Email + Password Registration Route
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body || {};

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Valid email address is required.' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long.' },
        { status: 400 }
      );
    }

    // Check if an account with this email already exists
    const existingUser = await prisma.user.findFirst({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists. Please sign in instead.' },
        { status: 409 }
      );
    }

    // Hash password with bcrypt (salt rounds = 10)
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new User record in Prisma database
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        githubId: null,
        githubUsername: null,
        accessToken: null,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Account created successfully.',
        userId: user.id,
        email: user.email,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[API /api/auth/signup] Registration error:', error);
    return NextResponse.json(
      { error: error?.message || 'An unexpected error occurred during registration.' },
      { status: 500 }
    );
  }
}
