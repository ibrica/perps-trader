import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getCookieValue, getHeaderValue } from '../utils/cookies';
import { RequestWithCookies } from '../utils/cookies';

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithCookies>();
    const csrfHeaderName = this.configService.get<string>(
      'auth.csrfHeaderName',
      'x-csrf-token',
    );
    const csrfCookieName = this.configService.get<string>(
      'auth.csrfCookieName',
      'perps_trader_dashboard_csrf',
    );

    const headerToken = getHeaderValue(request, csrfHeaderName);
    const cookieToken = getCookieValue(request, csrfCookieName);

    if (!headerToken || !cookieToken || headerToken !== cookieToken) {
      throw new ForbiddenException('Invalid CSRF token');
    }

    return true;
  }
}
