import { PositionDirection as DriftPositionDirection } from '@drift-labs/sdk';

// Custom string-based enum for database compatibility
export enum PositionDirection {
  LONG = 'LONG',
  SHORT = 'SHORT',
}

// Helper functions to convert to/from Drift SDK format
export const toDriftPositionDirection = (
  direction: PositionDirection,
): DriftPositionDirection => {
  return direction === PositionDirection.LONG
    ? DriftPositionDirection.LONG
    : DriftPositionDirection.SHORT;
};

export const fromDriftPositionDirection = (
  driftDirection: DriftPositionDirection,
): PositionDirection => {
  if (driftDirection === DriftPositionDirection.LONG) {
    return PositionDirection.LONG;
  }
  return PositionDirection.SHORT;
};
