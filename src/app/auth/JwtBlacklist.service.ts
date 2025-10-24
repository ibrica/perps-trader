import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtBlacklistService {
  private readonly blacklistedTokens = new Set<string>();

  constructor(private readonly jwtService: JwtService) {}

  addToBlacklist(token: string): void {
    this.blacklistedTokens.add(token);
  }

  isBlacklisted(token: string): boolean {
    return this.blacklistedTokens.has(token);
  }

  removeFromBlacklist(token: string): void {
    this.blacklistedTokens.delete(token);
  }

  // Clean up expired tokens periodically
  cleanupExpiredTokens(): void {
    const now = Date.now();
    for (const token of this.blacklistedTokens) {
      try {
        const decoded = this.jwtService.decode(token) as {
          exp?: number;
        } | null;
        if (decoded && decoded.exp && decoded.exp * 1000 < now) {
          this.blacklistedTokens.delete(token);
        }
      } catch {
        // Remove invalid tokens
        this.blacklistedTokens.delete(token);
      }
    }
  }

  getBlacklistSize(): number {
    return this.blacklistedTokens.size;
  }
}
