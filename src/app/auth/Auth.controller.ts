import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { AuthService } from './Auth.service';
import { GoogleAuthGuard } from './guards/Google-auth.guard';
import { JwtAuthGuard } from './guards/Jwt-auth.guard';
import { GoogleProfile } from './strategies/Google.strategy';

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  async googleAuth(@Req() req: Request): Promise<void> {
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

    // Redirect to frontend dashboard with token
    const dashboardUrl = this.configService.get<string>('auth.dashboardUrl');
    const redirectUrl = `${dashboardUrl}/auth/callback?token=${tokens.accessToken}`;

    res.redirect(redirectUrl);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: Request): Promise<any> {
    return req.user;
  }

  @Get('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Res() res: Response): Promise<void> {
    // Client-side should remove the token
    // Server doesn't need to do anything for JWT-based auth
    res.json({ message: 'Logged out successfully' });
  }
}
