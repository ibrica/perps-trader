import { TestingModule } from '@nestjs/testing';
import { MongooseModule } from '@nestjs/mongoose';
import { LockService } from './Lock.service';
import { LockRepository } from './Lock.repository';
import { Lock, LockSchema } from './Lock.schema';
import {
  createTestingModuleWithProviders,
  MongoDbTestingModule,
  MongoDbTestingService,
  forceGC,
} from '../../shared';

describe('LockService', () => {
  let service: LockService;
  let repository: LockRepository;
  let mongoDbTestingService: MongoDbTestingService;
  let module: TestingModule;

  beforeEach(async () => {
    module = await createTestingModuleWithProviders({
      imports: [
        MongooseModule.forFeature([{ name: Lock.name, schema: LockSchema }]),
        TestingModule,
        MongoDbTestingModule,
      ],
      providers: [LockService, LockRepository],
    }).compile();

    service = module.get(LockService);
    repository = module.get(LockRepository);
    mongoDbTestingService = await module.resolve(MongoDbTestingService);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await mongoDbTestingService.clean();
  });

  afterAll(async () => {
    await mongoDbTestingService.close();
    await module.close();
    forceGC();
  });

  describe('acquireLock', () => {
    it('should successfully acquire a new lock', async () => {
      const lockName = 'test-lock';
      const leaseUntil = new Date(Date.now() + 60000); // 1 minute from now

      const result = await service.acquireLock(lockName, leaseUntil);

      expect(result).toBe(true);

      // Verify lock was created in database
      const lock = await repository.getOne({ filter: { name: lockName } });
      expect(lock).toBeDefined();
      expect(lock!.name).toBe(lockName);
      expect(lock!.leaseUntil.getTime()).toBeGreaterThanOrEqual(
        leaseUntil.getTime() - 1,
      );
    });

    it('should fail to acquire lock when already held by another process', async () => {
      const lockName = 'test-lock';
      const firstLeaseUntil = new Date(Date.now() + 60000);

      // First process acquires lock
      const firstAcquire = await service.acquireLock(lockName, firstLeaseUntil);
      expect(firstAcquire).toBe(true);

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Second process tries to acquire same lock with different time
      const secondLeaseUntil = new Date(Date.now() + 120000);
      const secondAcquire = await service.acquireLock(
        lockName,
        secondLeaseUntil,
      );

      expect(secondAcquire).toBe(false);
    });

    it('should successfully acquire expired lock', async () => {
      const lockName = 'test-lock';
      const expiredLeaseUntil = new Date(Date.now() - 1000); // 1 second ago
      const newLeaseUntil = new Date(Date.now() + 60000);

      // Create expired lock
      await repository.create({
        name: lockName,
        leaseUntil: expiredLeaseUntil,
      });

      // Try to acquire expired lock
      const result = await service.acquireLock(lockName, newLeaseUntil);

      expect(result).toBe(true);

      // Verify lock was updated
      const lock = await repository.getOne({ filter: { name: lockName } });
      expect(lock!.leaseUntil.getTime()).toBeGreaterThanOrEqual(
        newLeaseUntil.getTime() - 1,
      );
    });

    it('should handle multiple different locks', async () => {
      const lock1Name = 'lock-1';
      const lock2Name = 'lock-2';
      const leaseUntil = new Date(Date.now() + 60000);

      const result1 = await service.acquireLock(lock1Name, leaseUntil);
      const result2 = await service.acquireLock(lock2Name, leaseUntil);

      expect(result1).toBe(true);
      expect(result2).toBe(true);

      // Verify both locks exist
      const locks = await repository.getAll();
      expect(locks).toHaveLength(2);
    });

    it('should handle concurrent attempts on different locks', async () => {
      const lock1Name = 'race-lock-1';
      const lock2Name = 'race-lock-2';
      const leaseUntil1 = new Date(Date.now() + 60000);
      const leaseUntil2 = new Date(Date.now() + 120000);

      // Acquire different locks concurrently - both should succeed
      const [result1, result2] = await Promise.all([
        service.acquireLock(lock1Name, leaseUntil1),
        service.acquireLock(lock2Name, leaseUntil2),
      ]);

      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });
  });

  describe('releaseLock', () => {
    it('should successfully release a lock', async () => {
      const lockName = 'test-lock';
      const leaseUntil = new Date(Date.now() + 60000);

      // Acquire lock first
      await service.acquireLock(lockName, leaseUntil);

      // Verify lock exists
      let lock = await repository.getOne({ filter: { name: lockName } });
      expect(lock).toBeDefined();

      // Release lock
      await service.releaseLock(lockName);

      // Verify lock is deleted
      lock = await repository.getOne({ filter: { name: lockName } });
      expect(lock).toBeNull();
    });

    it('should handle releasing non-existent lock gracefully', async () => {
      await expect(
        service.releaseLock('non-existent-lock'),
      ).resolves.not.toThrow();
    });

    it('should only release specified lock', async () => {
      const lock1Name = 'lock-1';
      const lock2Name = 'lock-2';
      const leaseUntil = new Date(Date.now() + 60000);

      // Acquire two locks
      await service.acquireLock(lock1Name, leaseUntil);
      await service.acquireLock(lock2Name, leaseUntil);

      // Release only first lock
      await service.releaseLock(lock1Name);

      // Verify only first lock is deleted
      const lock1 = await repository.getOne({ filter: { name: lock1Name } });
      const lock2 = await repository.getOne({ filter: { name: lock2Name } });

      expect(lock1).toBeNull();
      expect(lock2).toBeDefined();
    });
  });

  describe('integration: acquire and release lifecycle', () => {
    it('should handle complete lock lifecycle', async () => {
      const lockName = 'lifecycle-lock';
      const leaseUntil1 = new Date(Date.now() + 60000);

      // Acquire lock
      const acquired = await service.acquireLock(lockName, leaseUntil1);
      expect(acquired).toBe(true);

      // Small delay to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Try to acquire again with different lease time (should fail)
      const leaseUntil2 = new Date(Date.now() + 120000);
      const acquiredAgain = await service.acquireLock(lockName, leaseUntil2);
      expect(acquiredAgain).toBe(false);

      // Release lock
      await service.releaseLock(lockName);

      // Should be able to acquire again
      const leaseUntil3 = new Date(Date.now() + 60000);
      const reacquired = await service.acquireLock(lockName, leaseUntil3);
      expect(reacquired).toBe(true);
    });

    it('should handle expired lock re-acquisition', async () => {
      const lockName = 'expiry-lock';
      const shortLeaseUntil = new Date(Date.now() + 100); // 100ms

      // Acquire lock with short lease
      const acquired = await service.acquireLock(lockName, shortLeaseUntil);
      expect(acquired).toBe(true);

      // Wait for lock to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should be able to acquire expired lock
      const newLeaseUntil = new Date(Date.now() + 60000);
      const reacquired = await service.acquireLock(lockName, newLeaseUntil);
      expect(reacquired).toBe(true);
    });
  });
});
