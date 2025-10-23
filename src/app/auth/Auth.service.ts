import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import { GoogleProfile } from './strategies/Google.strategy';
import { JwtPayload } from './strategies/Jwt.strategy';

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
    // In a real application, you would fetch the user from the database
    // For now, we just return the user info from the JWT payload
    return {
      email: payload.email,
      firstName: '',
      lastName: '',
      picture: '',
    };
  }

  generateCsrfToken(): string {
    return randomBytes(32).toString('hex');
  }
}
