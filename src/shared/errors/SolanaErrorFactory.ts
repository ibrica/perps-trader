import { NodeIsBehindError } from './NodeIsBehindError';
import { ProcessedTransactionError } from './ProcessedTransactionError';
import { BlockhashNotFoundError } from './BlockhashNotFoundError';
import { UnknownError } from './UnknownError';
import { InsufficientBalanceError } from './InsufficientBalanceError';
import { InsufficientSolBalanceError } from './InsufficientSolBalanceError';
import { BaseSolanaError } from './BaseSolanaError';
import { TokenAccountNotFoundError } from './TokenAccountNotFoundError';
import { WrongProgramError } from './WrongProgramError';
import { DebitAccountError } from './DebitAccountError';
import { TransactionExpiredError } from './TransactionExpiredError';
import { InvalidSlippageError } from './InvalidSlippageError';
import { ThresholdReachedError } from './ThresholdReachedError';
import { ArithmeticsError } from './ArithmeticsError';
import { InvalidCurveAccountError } from './InvalidCurveAccountError';
import { MinimalTradeAmountError } from './MinimalTradeAmountError';
import { TokenNameTooLongError } from './TokenNameTooLongError';
import { TokenSymbolTooLongError } from './TokenSymbolTooLongError';
import { TokenURITooLongError } from './TokenURITooLongError';
import { InvalidAmountError } from './InvalidAmountError';
import { InvalidTokenAccountError } from './InvalidTokenAccountError';
import { TokenSymbolDuplicateError } from './TokenSymbolDuplicateError';
import { InsufficientFundsForRentError } from './InsufficientFundsForRentError';

export class SolanaErrorFactory {
  private static readonly supportedErrors = [
    BlockhashNotFoundError,
    InsufficientBalanceError,
    NodeIsBehindError,
    ProcessedTransactionError,
    TokenAccountNotFoundError,
    WrongProgramError,
    DebitAccountError,
    TransactionExpiredError,
    InvalidSlippageError,
    ThresholdReachedError,
    ArithmeticsError,
    InvalidCurveAccountError,
    MinimalTradeAmountError,
    TokenNameTooLongError,
    TokenSymbolTooLongError,
    TokenURITooLongError,
    InvalidAmountError,
    InvalidTokenAccountError,
    TokenSymbolDuplicateError,
    InsufficientSolBalanceError,
    InsufficientFundsForRentError,
  ];

  static of(e: unknown): BaseSolanaError {
    const errorString = String(e);
    for (const error of SolanaErrorFactory.supportedErrors) {
      if (
        error.messagePatterns.some((pattern) => errorString.includes(pattern))
      ) {
        return new error(errorString);
      }
    }
    return new UnknownError(JSON.stringify(e));
  }
}
