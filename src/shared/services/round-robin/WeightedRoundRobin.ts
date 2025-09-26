import { ILoadBalancer } from './ILoadBalancer';

export class WeightedRoundRobin<T> implements ILoadBalancer<T> {
  private readonly probabilities: number[];

  private readonly aliases: number[];

  private readonly items: T[];

  constructor(weightedItems: Array<{ item: T; weight: number }>) {
    const n = weightedItems.length;
    this.items = weightedItems.map((wi) => wi.item);

    const totalWeight = weightedItems.reduce((sum, wi) => sum + wi.weight, 0);
    const normalizedWeights = weightedItems.map(
      (wi) => (wi.weight / totalWeight) * n,
    );

    this.probabilities = new Array(n).fill(0);
    this.aliases = new Array(n).fill(0);

    const small: number[] = [];
    const large: number[] = [];

    normalizedWeights.forEach((weight, i) => {
      if (weight < 1) {
        small.push(i);
      } else {
        large.push(i);
      }
    });

    while (small.length && large.length) {
      const smallIndex = small.pop()!;
      const largeIndex = large.pop()!;

      // Set probability and alias
      this.probabilities[smallIndex] = normalizedWeights[smallIndex];
      this.aliases[smallIndex] = largeIndex;

      // Adjust large item's weight
      normalizedWeights[largeIndex] -= 1 - normalizedWeights[smallIndex];

      // Reclassify if needed
      if (normalizedWeights[largeIndex] < 1) {
        small.push(largeIndex);
      } else {
        large.push(largeIndex);
      }
    }

    // Handle remaining items
    while (large.length) {
      const index = large.pop()!;
      this.probabilities[index] = 1;
    }
    while (small.length) {
      const index = small.pop()!;
      this.probabilities[index] = 1;
    }
  }

  /**
   * Select an item with O(1) time complexity
   * @returns Randomly selected item based on weights
   */
  next(): T {
    const n = this.items.length;
    const index = Math.floor(Math.random() * n);

    const randomProb = Math.random();

    const finalIndex =
      randomProb < this.probabilities[index] ? index : this.aliases[index];

    return this.items[finalIndex];
  }

  /**
   * Get distribution of selections to verify weight proportions
   * @param iterations Number of selections to simulate
   * @returns Object with selection counts
   */
  getDistribution(iterations: number = 10000): Record<string, number> {
    const distribution: Record<string, number> = {};

    // Initialize distribution
    this.items.forEach((item) => {
      distribution[String(item)] = 0;
    });

    // Simulate selections
    for (let i = 0; i < iterations; i++) {
      const selected = this.next();
      distribution[String(selected)]++;
    }

    return distribution;
  }
}
