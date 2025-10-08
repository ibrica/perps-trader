require('reflect-metadata');
require('dotenv').config({ path: '.env.test' });

// Jest setup for module aliases
const moduleNameMapper =
  require('./package.json').jest.projects[0].moduleNameMapper;
const { pathsToModuleNameMapper } = require('ts-jest');
const { compilerOptions } = require('./tsconfig.json');

module.exports = {
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, {
    prefix: '<rootDir>/',
  }),
};
