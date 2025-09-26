import { Injectable, Logger, Optional } from '@nestjs/common';
import {
  BasePlatformService,
  BlockchainServiceProvider,
  BlockchainSymbol,
  CreateTradeOptions,
  Platform,
  stringify,
  TradeStatus,
  SOL_MINT,
  SwapType,
} from '../../shared';
import { TradeRepository } from './Trade.repository';
import { RaydiumService } from '../raydium/Raydium.service';
import { SolanaService } from '../../infrastructure/services/solana/SolanaService';
import { PumpFunService } from '../pumpfun/PumpFun.service';
import { CurrencyService } from '../currency/Currency.service';
import { TradeDocument } from './Trade.schema';
import { HyperliquidPlatformService } from '../hyperliquid/HyperliquidPlatform.service';
import { DriftPlatformService } from '../drift/DriftPlatform.service';
import { JupiterPlatformService } from '../jupiter/JupiterPlatform.service';

@Injectable()
export class TradeService {
  private solanaService: SolanaService;
  private logger = new Logger(TradeService.name);

  constructor(
    private readonly tradeRepository: TradeRepository,
    private blockchainPortProvider: BlockchainServiceProvider,
    private raydiumService: RaydiumService,
    private pumpfunService: PumpFunService,
    private currencyService: CurrencyService,
    @Optional() private hyperliquidPlatformService?: HyperliquidPlatformService,
    @Optional() private driftPlatformService?: DriftPlatformService,
    @Optional() private jupiterPlatformService?: JupiterPlatformService,
  ) {
    this.solanaService = this.blockchainPortProvider.for(BlockchainSymbol.SOL); // TODO: refactor if adding different blockchains
  }

  async executeTrade(createTradeOptions: CreateTradeOptions): Promise<void> {
    const sender = this.solanaService.getSignatureWalletKey();

    const { amountIn, mintFrom, mintTo } = createTradeOptions;

    // First create the trade record to trigger validation before any API calls
    this.logger.log(`Executing trade ${stringify(createTradeOptions)}`);
    const trade = await this.tradeRepository.create({
      ...createTradeOptions,
      status: TradeStatus.CREATED,
      sender,
      expectedMarginalAmountOut:
        createTradeOptions.expectedMarginalAmountOut || 0n,
    });

    const { platform } = trade;
    if (!platform) {
      throw new Error('Platform not found');
    }

    // Use platform-specific pricing calculation
    const expectedAmountOut = await this.calculateExpectedAmountOut(
      platform,
      mintFrom,
      mintTo,
      amountIn,
    );

    const platformService = this.getPlatformService(platform);

    let tradeResult: {
      transactionId: string;
      status: 'success' | 'pending' | 'failed';
      message?: string;
    };
    try {
      // Try direct trade execution first (for platforms like Hyperliquid)
      tradeResult = await platformService.executeTrade(createTradeOptions);

      if (tradeResult.status === 'success') {
        this.logger.log(`Direct trade execution successful`, {
          transactionId: tradeResult.transactionId,
          platform,
        });
      } else {
        this.logger.warn(
          `Direct trade execution failed, falling back to Solana transaction flow`,
          {
            platform,
            message: tradeResult.message,
          },
        );

        // Fallback to Solana transaction preparation and submission for platforms that support it
        if (platform === Platform.RAYDIUM || platform === Platform.PUMP_FUN) {
          const { expectedMarginalAmountOut, pool, poolType, swapType } =
            createTradeOptions;
          const options = {
            sender,
            amountIn,
            decimalsIn: await this.currencyService.getDecimalsForMint(mintFrom),
            marginalAmountOut: expectedMarginalAmountOut || 0n,
            decimalsOut: await this.currencyService.getDecimalsForMint(mintTo),
            mintFrom,
            mintTo,
            blockchain: createTradeOptions.blockchain,
            pool,
            poolType,
            swapType: swapType || SwapType.EXACT_IN,
          };
          const preparedTx = await platformService.prepare(options);
          const signedTx = await this.solanaService.signVersionedTx(preparedTx);
          const submitResult = await platformService.submit(
            signedTx,
            platformService.getPriorityOptions(),
            this.logger,
            this.solanaService,
          );

          tradeResult = {
            transactionId: submitResult.transactionSignature,
            status: submitResult.status === 'SUCCESS' ? 'success' : 'failed',
            message: `Solana transaction ${submitResult.status}`,
          };
        }
      }
    } catch (error) {
      this.logger.error(`Trade execution failed`, error);
      tradeResult = {
        transactionId: '',
        status: 'failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // TODO: Fix this, it is no good
    const tradeId = String(trade._id);
    const isBuy = mintFrom === SOL_MINT; //

    await this.tradeRepository.updateById(tradeId, {
      status:
        tradeResult.status === 'success'
          ? TradeStatus.COMPLETED
          : TradeStatus.FAILED,
      expectedMarginalAmountOut: expectedAmountOut,
      amountOut:
        tradeResult.status === 'success'
          ? isBuy
            ? expectedAmountOut
            : (9n * expectedAmountOut) / 10n // presume 10% lost for now
          : 0n,
    });

    this.logger.log(`Trade completed ${tradeId}`);
  }

  async getTradesByTradePosition(
    tradePosition: string,
  ): Promise<TradeDocument[]> {
    return this.tradeRepository.getTradesByTradePosition(tradePosition);
  }

  private getPlatformService(platform: Platform): BasePlatformService {
    switch (platform) {
      case Platform.RAYDIUM:
        return this.raydiumService;
      case Platform.PUMP_FUN:
        return this.pumpfunService;
      case Platform.HYPERLIQUID:
        if (!this.hyperliquidPlatformService) {
          throw new Error(`Hyperliquid platform service not available`);
        }
        return this.hyperliquidPlatformService;
      case Platform.DRIFT:
        if (!this.driftPlatformService) {
          throw new Error(`Drift platform service not available`);
        }
        return this.driftPlatformService;
      case Platform.JUPITER:
        if (!this.jupiterPlatformService) {
          throw new Error(`Jupiter platform service not available`);
        }
        return this.jupiterPlatformService;
      default:
        throw new Error(`Platform service not found for platform: ${platform}`);
    }
  }

  private async calculateExpectedAmountOut(
    platform: Platform,
    mintFrom: string,
    mintTo: string,
    amountIn: bigint,
  ): Promise<bigint> {
    switch (platform) {
      case Platform.PUMP_FUN:
        const isBuy = mintFrom === SOL_MINT;
        return await this.pumpfunService.calculateExpectedAmountOut(
          isBuy ? mintTo : mintFrom,
          amountIn,
          isBuy,
        );

      case Platform.RAYDIUM:
        // TODO: Implement Raydium pricing calculation
        this.logger.warn(
          'Raydium pricing calculation not implemented, returning amountIn',
        );
        return amountIn;

      case Platform.JUPITER:
        // TODO: Implement Jupiter pricing calculation
        this.logger.warn(
          'Jupiter pricing calculation not implemented, returning amountIn',
        );
        return amountIn;

      case Platform.DRIFT:
        // For perpetual futures, return the position size (same as amountIn for simplicity)
        this.logger.debug('Drift perpetual position size equals amountIn');
        return amountIn;

      case Platform.HYPERLIQUID:
        // For Hyperliquid perpetual futures, return the position size
        this.logger.debug(
          'Hyperliquid perpetual position size equals amountIn',
        );
        return amountIn;

      default:
        this.logger.warn(`Unknown platform ${platform}, returning amountIn`);
        return amountIn;
    }
  }
}
