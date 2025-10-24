/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types */
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';

export interface GoogleProfile {
  email: string;
  firstName: string;
  lastName: string;
  picture: string;
  accessToken: string;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private configService: ConfigService) {
    super({
      clientID: configService.get<string>('auth.googleClientId'),
      clientSecret: configService.get<string>('auth.googleClientSecret'),
      callbackURL: configService.get<string>('auth.googleCallbackUrl'),
      scope: ['email', 'profile'],
      // Note: store and state options are handled by passport-google-oauth20 internally
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { name, emails, photos } = profile;

    if (!emails || emails.length === 0) {
      return done(
        new UnauthorizedException('No email found in Google profile'),
        null,
      );
    }

    const email = emails[0].value;
    const allowedEmails =
      this.configService.get<string[]>('auth.allowedEmails');

    // Check if user email is in the allowed list
    if (!allowedEmails || allowedEmails.length === 0) {
      return done(
        new UnauthorizedException('No allowed emails configured'),
        null,
      );
    }
    if (!allowedEmails.includes(email)) {
      return done(
        new UnauthorizedException(`Email ${email} is not authorized`),
        null,
      );
    }

    const user: GoogleProfile = {
      email,
      firstName: name.givenName,
      lastName: name.familyName,
      picture: photos[0]?.value || '',
      accessToken,
    };

    done(null, user);
  }
}
