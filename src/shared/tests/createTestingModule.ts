// eslint-disable import/no-extraneous-dependencies
import { Test } from '@nestjs/testing';
import { ModuleMetadata } from '@nestjs/common/interfaces/modules/module-metadata.interface';
import { TestingModuleBuilder } from '@nestjs/testing/testing-module.builder';
import { PrivateRpcService } from '../../app/private-rpc/PrivateRpc.service';
import { MockPrivateRpcService } from '../../app/private-rpc/MockPrivateRpc.service';
import { RaydiumService } from '../../app/raydium/Raydium.service';
import { MockRaydiumService } from '../../app/raydium/MockRaydiumService';

export const createTestingModuleWithProviders = (
  params: ModuleMetadata,
): TestingModuleBuilder => {
  const imports = params.imports ?? [];
  return Test.createTestingModule({
    ...params,
    imports: [...imports],
  })
    .overrideProvider(RaydiumService)
    .useClass(MockRaydiumService)
    .overrideProvider(PrivateRpcService)
    .useClass(MockPrivateRpcService);
};
