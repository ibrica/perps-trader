import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import { GoogleProfile } from './strategies/Google.strategy';
import { JwtPayload } from './strategies/Jwt.strategy';
import { JwtBlacklistService } from './JwtBlacklist.service';

export interface AuthTokens {
  accessToken: string;
  expiresIn: string;
  expiresAt: number | null;
}

export interface AuthUser {
  email: string;
  firstName: string;
  lastName: string;
  picture: string;
}

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private jwtBlacklistService: JwtBlacklistService,
  ) {}

  async validateGoogleUser(googleProfile: GoogleProfile): Promise<AuthUser> {
    // In a real application, you might want to save/update the user in a database here
    return {
      email: googleProfile.email,
      firstName: googleProfile.firstName,
      lastName: googleProfile.lastName,
      picture: googleProfile.picture,
    };
  }

  async generateTokens(user: AuthUser): Promise<AuthTokens> {
    const payload: JwtPayload = {
      email: user.email,
      sub: user.email, // Using email as subject
    };

    const accessToken = this.jwtService.sign(payload);
    const expiresIn = this.configService.get<string>('auth.jwtExpiresIn', '7d');
    const decoded = this.jwtService.decode(accessToken) as
      | (JwtPayload & { exp?: number })
      | null;
    const expiresAt = decoded && decoded.exp ? decoded.exp * 1000 : null;

    return {
      accessToken,
      expiresIn,
      expiresAt,
    };
  }

  async validateUser(payload: JwtPayload): Promise<AuthUser | null> {
    // Check if token is blacklisted
    if (this.jwtBlacklistService.isBlacklisted(payload.sub)) {
      return null;
    }

    // In a real application, you would fetch the user from the database
    // For now, we just return the user info from the JWT payload
    return {
      email: payload.email,
      firstName: '',
      lastName: '',
      picture: '',
    };
  }

  blacklistToken(token: string): void {
    this.jwtBlacklistService.addToBlacklist(token);
  }

  generateCsrfToken(): string {
    const timestamp = Date.now().toString(16);
    const randomPart = randomBytes(24).toString('hex');
    return `${timestamp}:${randomPart}`;
  }

  validateCsrfToken(token: string): boolean {
    if (!token || !token.includes(':')) {
      return false;
    }

    const [timestampStr] = token.split(':');
    const timestamp = parseInt(timestampStr, 16);
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    return now - timestamp <= maxAge;
  }
}
