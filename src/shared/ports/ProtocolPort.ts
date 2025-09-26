import { BlockchainSymbol, ProtocolVersion } from '..';

export abstract class ProtocolPort {
  abstract getLiveVersion(
    blockchainSymbol: BlockchainSymbol,
  ): Promise<ProtocolVersion>;
}
