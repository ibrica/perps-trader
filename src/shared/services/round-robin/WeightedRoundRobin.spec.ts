import { WeightedRoundRobin } from './WeightedRoundRobin';

describe('EfficientWeightedRoundRobin', () => {
  describe('with equal weights', () => {
    const servers = [
      { item: 'Server A', weight: 3 },
      { item: 'Server B', weight: 3 },
      { item: 'Server C', weight: 3 },
    ];

    let loadBalancer: WeightedRoundRobin<string>;

    beforeEach(() => {
      loadBalancer = new WeightedRoundRobin(servers);
    });

    it('should distribute load evenly', () => {
      // Run many selections to verify distribution
      const selections: Record<string, number> = {};
      const iterations = 10000;

      // Perform selections
      for (let i = 0; i < iterations; i++) {
        const selected = loadBalancer.next();
        selections[selected] = (selections[selected] || 0) + 1;
      }

      // Calculate percentages
      const percentages = Object.entries(selections).map(([server, count]) => ({
        server,
        percentage: (count / iterations) * 100,
      }));

      const marginOfErrorPrc = 10;
      const expectedPercentage = 33.33;
      percentages.forEach(({ percentage }) => {
        expect(percentage).toBeGreaterThan(
          (expectedPercentage * (100 - marginOfErrorPrc)) / 100,
        );
        expect(percentage).toBeLessThan(
          (expectedPercentage * (100 + marginOfErrorPrc)) / 100,
        );
      });
    });
  });

  describe('with variable weights', () => {
    const servers = [
      { item: 'Server A', weight: 1 },
      { item: 'Server B', weight: 1 },
      { item: 'Server C', weight: 3 },
    ];

    let loadBalancer: WeightedRoundRobin<string>;

    beforeEach(() => {
      loadBalancer = new WeightedRoundRobin(servers);
    });

    it('should distribute load evenly', () => {
      // Run many selections to verify distribution
      const selections: Record<string, number> = {};
      const iterations = 10000;

      // Perform selections
      for (let i = 0; i < iterations; i++) {
        const selected = loadBalancer.next();
        selections[selected] = (selections[selected] || 0) + 1;
      }

      // Calculate percentages
      const percentages = Object.entries(selections).map(([server, count]) => ({
        server,
        percentage: (count / iterations) * 100,
      }));

      const serverA = percentages.find(({ server }) => server === 'Server A');
      const serverB = percentages.find(({ server }) => server === 'Server B');
      const serverC = percentages.find(({ server }) => server === 'Server C');

      const marginOfErrorPrc = 10;
      expect(serverA?.percentage).toBeGreaterThan(
        (20 * (100 - marginOfErrorPrc)) / 100,
      );
      expect(serverA?.percentage).toBeLessThan(
        (20 * (100 + marginOfErrorPrc)) / 100,
      );
      expect(serverB?.percentage).toBeGreaterThan(
        (20 * (100 - marginOfErrorPrc)) / 100,
      );
      expect(serverB?.percentage).toBeLessThan(
        (20 * (100 + marginOfErrorPrc)) / 100,
      );
      expect(serverC?.percentage).toBeGreaterThan(
        (60 * (100 - marginOfErrorPrc)) / 100,
      );
      expect(serverC?.percentage).toBeLessThan(
        (60 * (100 + marginOfErrorPrc)) / 100,
      );
    });
  });
});
