import { Request } from 'express';

export type RequestWithCookies = Request & {
  cookies?: Record<string, string>;
};

export function getCookieValue(
  req: RequestWithCookies | undefined,
  name: string,
): string | null {
  if (!req) {
    return null;
  }

  if (req.cookies && typeof req.cookies[name] === 'string') {
    return req.cookies[name];
  }

  const { cookie: cookieHeader } = req.headers;

  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';');

  for (const rawCookie of cookies) {
    const [cookieName, ...rest] = rawCookie.split('=');
    if (!cookieName || rest.length === 0) {
      continue;
    }

    if (cookieName.trim() === name) {
      return decodeURIComponent(rest.join('=').trim());
    }
  }

  return null;
}

export function getHeaderValue(
  req: Request | undefined,
  headerName: string,
): string | null {
  if (!req) {
    return null;
  }

  const headerKey = headerName.toLowerCase();
  const value = req.headers[headerKey];

  if (!value) {
    return null;
  }

  return Array.isArray(value) ? value[0] : value;
}
