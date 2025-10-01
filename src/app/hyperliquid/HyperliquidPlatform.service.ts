import { Injectable, Logger, Optional } from '@nestjs/common';
import { BasePlatformService, PositionExecutionResult } from '../../shared';
import { EnterPositionOptions, Platform, TradeType } from '../../shared';
import { HyperliquidService } from '../../infrastructure/hyperliquid/HyperliquidService';

@Injectable()
export class HyperliquidPlatformService extends BasePlatformService {
  exitPosition(positionId: string): Promise<PositionExecutionResult> {
    throw new Error('Method not implemented.');
  }
  private readonly logger = new Logger(HyperliquidPlatformService.name);

  constructor(
    @Optional() private readonly hyperliquidService?: HyperliquidService,
  ) {
    super();
    this.logger.log(`HyperliquidPlatformService constructor called`, {
      hyperliquidServiceAvailable: !!this.hyperliquidService,
      hyperliquidServiceType: this.hyperliquidService
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (this.hyperliquidService as any).constructor?.name
        : 'undefined',
    });
  }

  async prepare(): Promise<void> {
    throw new Error('Hyperliquid does not support transaction preparation');
  }

  async enterPosition(
    options: EnterPositionOptions,
  ): Promise<PositionExecutionResult> {
    this.logger.log(`Executing Hyperliquid trade`, {
      platform: options.platform,
      tradeType: options.tradeType,
      mintFrom: options.currencyFrom,
      mintTo: options.currencyTo,
      amountIn: options.amountIn.toString(),
    });

    if (!this.hyperliquidService) {
      this.logger.error(
        `Hyperliquid service not available during executeTrade`,
        {
          hyperliquidServiceAvailable: !!this.hyperliquidService,
          serviceType: this.hyperliquidService
            ? (this.hyperliquidService as any).constructor?.name
            : 'undefined',
          serviceInstance: this.hyperliquidService,
        },
      );
      return {
        orderId: '',
        status: 'failed',
        message:
          'Hyperliquid service not available - missing configuration or dependencies',
      };
    }

    try {
      if (options.platform !== Platform.HYPERLIQUID) {
        throw new Error(
          `Invalid platform for Hyperliquid service: ${options.platform}`,
        );
      }

      if (options.tradeType !== TradeType.PERPETUAL) {
        throw new Error(
          `Hyperliquid only supports perpetual futures trading, got: ${options.tradeType}`,
        );
      }

      // Map token symbols to Hyperliquid format
      // For Hyperliquid perps, mintTo is the base asset (BTC, ETH, etc.)
      // and mintFrom would typically be USDC (the quote asset)
      const symbol = this.mapTokenToSymbol(options.currencyTo);

      // Determine direction based on the trade
      // For perps, we're either going long or short on the base asset
      // amountIn represents the quote amount (USDC) we want to use
      const direction = this.determineDirection();

      const result = await this.hyperliquidService.placePerpOrder({
        symbol,
        direction,
        quoteAmount: options.amountIn,
        // Use market order by default (no price specified)
        tif: 'Ioc', // Immediate or Cancel for market-like execution
      });

      this.logger.log(`Hyperliquid order placed successfully`, {
        orderId: result.orderId,
        symbol,
        direction,
        quoteAmount: options.amountIn.toString(),
      });

      return {
        orderId: result.orderId,
        status: 'success',
        message: `Hyperliquid ${direction} order placed for ${symbol}`,
      };
    } catch (error) {
      this.logger.error('Failed to execute Hyperliquid trade', error);

      return {
        orderId: '',
        status: 'failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private mapTokenToSymbol(mint: string): string {
    // Map token mints/addresses to Hyperliquid symbols
    // This is a simplified mapping - in production you'd want a proper registry
    const tokenMapping: Record<string, string> = {
      BTC: 'BTC',
      ETH: 'ETH',
      SOL: 'SOL',
      // Add more mappings as needed
    };

    return tokenMapping[mint] || mint;
  }

  private determineDirection(): 'LONG' | 'SHORT' {
    // For now, we'll default to LONG
    // In a real implementation, you'd determine this based on:
    // - AI prediction/recommendation
    // - User preference
    // - Market analysis
    //
    // This could be extended to use additional fields in CreateTradeOptions
    // or be determined by the trading strategy
    return 'LONG';
  }
}
