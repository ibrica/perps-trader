import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { getCookieValue, RequestWithCookies } from '../utils/cookies';

export interface JwtPayload {
  email: string;
  sub: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private configService: ConfigService) {
    const authCookieName = configService.get<string>(
      'auth.authCookieName',
      'perps_trader_dashboard_auth',
    );
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: RequestWithCookies): string | null =>
          getCookieValue(request, authCookieName),
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('auth.jwtSecret'),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    if (!payload.email) {
      throw new UnauthorizedException('Invalid token payload');
    }

    return {
      email: payload.email,
      sub: payload.sub,
    };
  }
}
