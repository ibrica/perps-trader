// eslint-disable import/no-extraneous-dependencies
import { Test } from '@nestjs/testing';
import { ModuleMetadata } from '@nestjs/common/interfaces/modules/module-metadata.interface';
import { TestingModuleBuilder } from '@nestjs/testing/testing-module.builder';

export const createTestingModuleWithProviders = (
  params: ModuleMetadata,
): TestingModuleBuilder => {
  const imports = params.imports ?? [];
  return Test.createTestingModule({
    ...params,
    imports: [...imports],
  });
};
