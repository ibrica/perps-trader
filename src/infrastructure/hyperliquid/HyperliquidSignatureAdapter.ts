import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { ethers } from 'ethers';
import { HL_HEADERS } from '../../shared/constants/hyperliquid';
import { EIP712TypedData } from './types';

export interface SignRequestInput {
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  query?: Record<string, string | number>;
  body?: unknown;
  timestampMs?: number;
  nonce?: string;
}

export interface SignRequestOutput {
  headers: Record<string, string>;
  timestampMs: number;
  nonce?: string;
}

@Injectable()
export class HyperliquidSignatureAdapter {
  private wallet: ethers.Wallet;
  private publicAddress: string;

  constructor(privateKey: string) {
    // Create an ethers wallet from the private key
    this.wallet = new ethers.Wallet(privateKey);
    this.publicAddress = this.wallet.address.toLowerCase();
  }

  /**
   * Get the public address associated with this adapter
   */
  getPublicAddress(): string {
    return this.publicAddress;
  }

  /**
   * Sign a request for Hyperliquid API
   *
   * Hyperliquid uses Ethereum personal_sign for API authentication.
   * Reference: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/signing
   *
   * The signature scheme follows the pattern:
   * 1. Create a canonical message from the request (timestamp:method:path:query:body_hash:nonce)
   * 2. Sign using Ethereum's personal_sign (prefixed with "\x19Ethereum Signed Message:\n")
   * 3. Return headers with signature and metadata
   *
   * Headers used:
   * - X-Signature: The signature
   * - X-Timestamp: Unix timestamp in milliseconds
   * - X-Account: Ethereum address (lowercase)
   * - X-Nonce: Random nonce for request uniqueness
   */
  async signRequest(input: SignRequestInput): Promise<SignRequestOutput> {
    const timestampMs = input.timestampMs || Date.now();
    const nonce = input.nonce || this.generateNonce();

    // Build the canonical message to sign
    const message = this.buildCanonicalMessage({
      ...input,
      timestampMs,
      nonce,
    });

    // Sign the message using ethers
    const signature = await this.signMessage(message);

    // Build and return the headers
    const headers: Record<string, string> = {
      [HL_HEADERS.SIGNATURE]: signature,
      [HL_HEADERS.TIMESTAMP]: timestampMs.toString(),
      [HL_HEADERS.ADDRESS]: this.publicAddress,
    };

    if (nonce) {
      headers[HL_HEADERS.NONCE] = nonce;
    }

    if (input.method === 'POST') {
      headers[HL_HEADERS.CONTENT_TYPE] = 'application/json';
    }

    return {
      headers,
      timestampMs,
      nonce,
    };
  }

  /**
   * Build canonical message for signing
   *
   * The exact format depends on Hyperliquid's specification.
   * This is a common pattern but should be verified against their docs.
   */
  private buildCanonicalMessage(params: {
    method: string;
    path: string;
    query?: Record<string, string | number>;
    body?: unknown;
    timestampMs: number;
    nonce?: string;
  }): string {
    const parts: string[] = [
      params.timestampMs.toString(),
      params.method.toUpperCase(),
      params.path,
    ];

    // Add query parameters if present
    if (params.query && Object.keys(params.query).length > 0) {
      const sortedQuery = Object.keys(params.query)
        .sort()
        .map((key) => `${key}=${params.query![key]}`)
        .join('&');
      parts.push(sortedQuery);
    } else {
      parts.push('');
    }

    // Add body hash if present
    if (params.body) {
      const bodyStr =
        typeof params.body === 'string'
          ? params.body
          : JSON.stringify(params.body);
      const bodyHash = createHash('sha256').update(bodyStr).digest('hex');
      parts.push(bodyHash);
    } else {
      parts.push('');
    }

    // Add nonce if present
    if (params.nonce) {
      parts.push(params.nonce);
    }

    return parts.join(':');
  }

  /**
   * Sign a message using the wallet
   *
   * Hyperliquid likely uses standard Ethereum signing.
   * The exact method (personal_sign vs typed data) should be verified.
   */
  private async signMessage(message: string): Promise<string> {
    // Method 1: Personal sign (most common for APIs)
    const signature = await this.wallet.signMessage(message);
    return signature;

    // Alternative Method 2: If Hyperliquid uses typed data signing
    // This would require constructing EIP-712 typed data structure
    // const typedData = this.constructTypedData(message);
    // const signature = await this.wallet._signTypedData(
    //   typedData.domain,
    //   typedData.types,
    //   typedData.value
    // );
    // return signature;
  }

  /**
   * Generate a random nonce for request uniqueness
   */
  private generateNonce(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Helper method to create typed data structure if needed
   * (Currently unused but included for potential future use)
   */
  private constructTypedData(message: string): EIP712TypedData {
    return {
      domain: {
        name: 'Hyperliquid',
        version: '1',
        chainId: 1337, // Hyperliquid's chain ID
      },
      types: {
        Message: [
          { name: 'content', type: 'string' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'nonce', type: 'string' },
        ],
      },
      primaryType: 'Message',
      value: {
        content: message,
        timestamp: Date.now(),
        nonce: this.generateNonce(),
      },
    };
  }
}
