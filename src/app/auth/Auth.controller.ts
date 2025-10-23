import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, CookieOptions } from 'express';
import { AuthService } from './Auth.service';
import { GoogleAuthGuard } from './guards/Google-auth.guard';
import { JwtAuthGuard } from './guards/Jwt-auth.guard';
import { GoogleProfile } from './strategies/Google.strategy';

const MILLISECONDS_PER_UNIT: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

function resolveMaxAge(expiresAt: number | null, expiresIn: string): number {
  if (expiresAt && expiresAt > Date.now()) {
    return Math.max(expiresAt - Date.now(), 0);
  }

  const match = expiresIn.match(/^(\d+)([smhd])$/i);
  if (!match) {
    return 7 * 24 * 60 * 60 * 1000; // default 7d
  }

  const amount = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const multiplier = MILLISECONDS_PER_UNIT[unit] || MILLISECONDS_PER_UNIT.d;

  return Math.max(amount * multiplier, 0);
}

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async googleAuth(@Req() _req: Request): Promise<void> {
    // Initiates the Google OAuth flow
    // Guard redirects to Google
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleAuthRedirect(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    // Handle the OAuth callback
    const googleProfile = req.user as GoogleProfile;

    // Validate and get/create user
    const user = await this.authService.validateGoogleUser(googleProfile);

    // Generate JWT tokens
    const tokens = await this.authService.generateTokens(user);
    const csrfToken = this.authService.generateCsrfToken();

    const dashboardUrl = this.configService.get<string>('auth.dashboardUrl');
    const cookieDomain = this.configService.get<string | undefined>(
      'auth.cookieDomain',
    );
    const cookieSecure = this.configService.get<boolean>(
      'auth.cookieSecure',
      false,
    );
    const sameSite = this.configService.get<'lax' | 'strict' | 'none'>(
      'auth.cookieSameSite',
      'lax',
    );
    const authCookieName = this.configService.get<string>(
      'auth.authCookieName',
      'perps_trader_dashboard_auth',
    );
    const csrfCookieName = this.configService.get<string>(
      'auth.csrfCookieName',
      'perps_trader_dashboard_csrf',
    );
    const maxAge = resolveMaxAge(tokens.expiresAt, tokens.expiresIn);

    const baseCookieOptions: CookieOptions = {
      httpOnly: true,
      secure: cookieSecure,
      sameSite,
      maxAge,
      path: '/',
      ...(cookieDomain ? { domain: cookieDomain } : {}),
    };

    res.cookie(authCookieName, tokens.accessToken, baseCookieOptions);
    res.cookie(
      csrfCookieName,
      csrfToken,
      {
        ...baseCookieOptions,
        httpOnly: false,
      },
    );

    res.redirect(`${dashboardUrl}/auth/callback`);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getProfile(@Req() req: Request): Promise<any> {
    return req.user;
  }

  @Get('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Res() res: Response): Promise<void> {
    const cookieDomain = this.configService.get<string | undefined>(
      'auth.cookieDomain',
    );
    const cookieSecure = this.configService.get<boolean>(
      'auth.cookieSecure',
      false,
    );
    const sameSite = this.configService.get<'lax' | 'strict' | 'none'>(
      'auth.cookieSameSite',
      'lax',
    );
    const authCookieName = this.configService.get<string>(
      'auth.authCookieName',
      'perps_trader_dashboard_auth',
    );
    const csrfCookieName = this.configService.get<string>(
      'auth.csrfCookieName',
      'perps_trader_dashboard_csrf',
    );

    const clearOptions: CookieOptions = {
      httpOnly: true,
      secure: cookieSecure,
      sameSite,
      path: '/',
      ...(cookieDomain ? { domain: cookieDomain } : {}),
    };

    res.clearCookie(authCookieName, clearOptions);
    res.clearCookie(csrfCookieName, { ...clearOptions, httpOnly: false });

    res.json({ message: 'Logged out successfully' });
  }
}
