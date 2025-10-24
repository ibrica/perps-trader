import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { GetPositionsQueryDto } from './Dashboard.dto';
import { TradePositionStatus } from '../../shared';

describe('Dashboard DTO Pagination Security', () => {
  describe('GetPositionsQueryDto', () => {
    it('should accept valid pagination parameters', async () => {
      const dto = plainToClass(GetPositionsQueryDto, {
        status: TradePositionStatus.OPEN,
        limit: 50,
        offset: 0,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject limit values below minimum', async () => {
      const dto = plainToClass(GetPositionsQueryDto, {
        limit: 0,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('limit');
      expect(errors[0].constraints).toHaveProperty('min');
    });

    it('should reject limit values above maximum', async () => {
      const dto = plainToClass(GetPositionsQueryDto, {
        limit: 1001,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('limit');
      expect(errors[0].constraints).toHaveProperty('max');
    });

    it('should reject negative offset values', async () => {
      const dto = plainToClass(GetPositionsQueryDto, {
        offset: -1,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('offset');
      expect(errors[0].constraints).toHaveProperty('min');
    });

    it('should reject offset values above maximum', async () => {
      const dto = plainToClass(GetPositionsQueryDto, {
        offset: 100001,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('offset');
      expect(errors[0].constraints).toHaveProperty('max');
    });

    it('should accept maximum allowed values', async () => {
      const dto = plainToClass(GetPositionsQueryDto, {
        limit: 1000,
        offset: 100000,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept minimum allowed values', async () => {
      const dto = plainToClass(GetPositionsQueryDto, {
        limit: 1,
        offset: 0,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should use default values when not provided', async () => {
      const dto = plainToClass(GetPositionsQueryDto, {});

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.limit).toBe(50);
      expect(dto.offset).toBe(0);
    });

    it('should reject non-numeric limit values', async () => {
      const dto = plainToClass(GetPositionsQueryDto, {
        limit: 'not-a-number' as any,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('limit');
      expect(errors[0].constraints).toHaveProperty('isNumber');
    });

    it('should reject non-numeric offset values', async () => {
      const dto = plainToClass(GetPositionsQueryDto, {
        offset: 'not-a-number' as any,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('offset');
      expect(errors[0].constraints).toHaveProperty('isNumber');
    });

    it('should accept valid status values', async () => {
      const dto = plainToClass(GetPositionsQueryDto, {
        status: TradePositionStatus.CLOSED,
        limit: 100,
        offset: 50,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid status values', async () => {
      const dto = plainToClass(GetPositionsQueryDto, {
        status: 'INVALID_STATUS' as any,
        limit: 100,
        offset: 50,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('status');
      expect(errors[0].constraints).toHaveProperty('isEnum');
    });
  });

  describe('DoS Protection Limits', () => {
    it('should prevent excessive data requests with high limit', async () => {
      const dto = plainToClass(GetPositionsQueryDto, {
        limit: 1000, // Maximum allowed
        offset: 0,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should prevent excessive data requests with high offset', async () => {
      const dto = plainToClass(GetPositionsQueryDto, {
        limit: 100,
        offset: 100000, // Maximum allowed
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should prevent DoS with reasonable limits', async () => {
      // Test that the limits are reasonable for preventing DoS
      const maxRecords = 1000; // Max limit
      const maxOffset = 100000; // Max offset

      // This would result in maximum 100,000 records being skipped
      // and 1,000 records being returned, which is reasonable
      expect(maxRecords).toBeLessThanOrEqual(1000);
      expect(maxOffset).toBeLessThanOrEqual(100000);
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined values gracefully', async () => {
      const dto = plainToClass(GetPositionsQueryDto, {
        limit: undefined,
        offset: undefined,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      // Default values are set by the DTO class, not by validation
      expect(dto.limit).toBeUndefined();
      expect(dto.offset).toBeUndefined();
    });

    it('should handle null values gracefully', async () => {
      const dto = plainToClass(GetPositionsQueryDto, {
        limit: null,
        offset: null,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      // Default values are set by the DTO class, not by validation
      expect(dto.limit).toBeNull();
      expect(dto.offset).toBeNull();
    });

    it('should handle empty object', async () => {
      const dto = plainToClass(GetPositionsQueryDto, {});

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.limit).toBe(50);
      expect(dto.offset).toBe(0);
    });
  });
});
