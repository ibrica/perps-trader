import { Injectable } from '@nestjs/common';
import { AuthGuard, IAuthModuleOptions } from '@nestjs/passport';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  getAuthenticateOptions(): IAuthModuleOptions | undefined {
    // Always show account picker to prevent automatic silent re-authentication
    return {
      prompt: 'select_account',
    };
  }
}
