import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query } from '../db/connection';
import { User, AuthResponse } from '../types';

const SALT_ROUNDS = 10;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

/**
 * Generate a JWT access token (short-lived, 15 min).
 */
function generateAccessToken(user: { id: number; email: string; name: string }): string {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    process.env.JWT_SECRET!,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

/**
 * Generate a refresh token (long-lived, 7 days).
 * Stored as a bcrypt hash in the database — the raw token is only sent to the client.
 */
async function generateRefreshToken(userId: number): Promise<string> {
  const rawToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = await bcrypt.hash(rawToken, SALT_ROUNDS);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

  await query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [userId, tokenHash, expiresAt]
  );

  return rawToken;
}

/**
 * Register a new user.
 * Returns access token + refresh token + user data.
 */
export async function register(
  name: string,
  email: string,
  password: string
): Promise<{ auth: AuthResponse; refreshToken: string }> {
  // Check if email already exists
  const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing.rows.length > 0) {
    throw new Error('Email already registered');
  }

  // Hash password and insert user
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const result = await query(
    'INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id, email, name, avatar_url, created_at',
    [email.toLowerCase(), name.trim(), passwordHash]
  );

  const user = result.rows[0];
  const accessToken = generateAccessToken(user);
  const refreshToken = await generateRefreshToken(user.id);

  return {
    auth: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
        created_at: user.created_at,
      } as Omit<User, 'password_hash'>,
      accessToken,
    },
    refreshToken,
  };
}

/**
 * Login an existing user.
 * Verifies email + password, returns tokens.
 */
export async function login(
  email: string,
  password: string
): Promise<{ auth: AuthResponse; refreshToken: string }> {
  const result = await query(
    'SELECT id, email, name, password_hash, avatar_url, created_at FROM users WHERE email = $1',
    [email.toLowerCase()]
  );

  if (result.rows.length === 0) {
    throw new Error('Invalid email or password');
  }

  const user = result.rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new Error('Invalid email or password');
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = await generateRefreshToken(user.id);

  return {
    auth: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
        created_at: user.created_at,
      } as Omit<User, 'password_hash'>,
      accessToken,
    },
    refreshToken,
  };
}

/**
 * Refresh an access token using a valid refresh token.
 * Finds all non-revoked, non-expired tokens for the user and checks each.
 */
export async function refreshAccessToken(
  rawRefreshToken: string
): Promise<{ accessToken: string; user: Omit<User, 'password_hash'> }> {
  // Find all valid (non-revoked, non-expired) refresh tokens
  const result = await query(
    `SELECT rt.id, rt.user_id, rt.token_hash, u.email, u.name, u.avatar_url, u.created_at
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.is_revoked = FALSE AND rt.expires_at > NOW()
     ORDER BY rt.created_at DESC`,
    []
  );

  // Check the raw token against each stored hash
  for (const row of result.rows) {
    const matches = await bcrypt.compare(rawRefreshToken, row.token_hash);
    if (matches) {
      const user = {
        id: row.user_id,
        email: row.email,
        name: row.name,
        avatar_url: row.avatar_url,
        created_at: row.created_at,
      };

      const accessToken = generateAccessToken(user);
      return { accessToken, user: user as Omit<User, 'password_hash'> };
    }
  }

  throw new Error('Invalid or expired refresh token');
}

/**
 * Logout — revoke all refresh tokens for the user.
 */
export async function logout(userId: number): Promise<void> {
  await query(
    'UPDATE refresh_tokens SET is_revoked = TRUE WHERE user_id = $1',
    [userId]
  );
}
