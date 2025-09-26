export enum PriorityLevel {
  Min = 'Min', // 0th percentile
  Low = 'Low', // 25th percentile
  Medium = 'Medium', // 50th percentile
  High = 'High', // 75th percentile
  VeryHigh = 'VeryHigh', // 95th percentile
  UnsafeMax = 'UnsafeMax', // 100th percentile
  Default = 'Default', // 50th percentile
}
