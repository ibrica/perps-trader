import { TestingModule } from '@nestjs/testing';
import { TradeOrderService } from './TradeOrder.service';
import {
  TradeOrderStatus,
  CreateTradeOrderOptions,
  UpdateTradeOrderOptions,
  MongoDbTestingModule,
  MongoDbTestingService,
  createTestingModuleWithProviders,
  forceGC,
} from '../../shared';
import { Types } from 'mongoose';
import { TradeOrderDocument } from './TradeOrder.schema';
import { TradeOrderModule } from './TradeOrder.module';

describe('TradeOrderService', () => {
  let service: TradeOrderService;
  let mongoDbTestingService: MongoDbTestingService;
  let module: TestingModule;

  beforeEach(async () => {
    module = await createTestingModuleWithProviders({
      imports: [TradeOrderModule, MongoDbTestingModule],
    }).compile();

    service = module.get(TradeOrderService);
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

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createTradeOrder', () => {
    const mockCreateOptions: CreateTradeOrderOptions = {
      status: TradeOrderStatus.CREATED,
      position: new Types.ObjectId().toString(),
      type: 'MARKET',
      orderId: 'order123',
      size: 100,
      price: 50000,
      fee: 5,
    };

    it('should create a trade order with CREATED status', async () => {
      const result = await service.createTradeOrder(mockCreateOptions);

      expect(result).toBeDefined();
      expect(result.status).toBe(TradeOrderStatus.CREATED);
      expect(result.position).toBe(mockCreateOptions.position);
      expect(result.type).toBe(mockCreateOptions.type);
      expect(result.orderId).toBe(mockCreateOptions.orderId);
      expect(result.size).toBe(mockCreateOptions.size);
      expect(result.price).toBe(mockCreateOptions.price);
      expect(result.fee).toBe(mockCreateOptions.fee);
    });

    it('should create a trade order without optional fields', async () => {
      const minimalOptions: CreateTradeOrderOptions = {
        status: TradeOrderStatus.PENDING,
        position: new Types.ObjectId().toString(),
        type: 'LIMIT',
      };

      const result = await service.createTradeOrder(minimalOptions);

      expect(result).toBeDefined();
      expect(result.status).toBe(TradeOrderStatus.PENDING);
      expect(result.position).toBe(minimalOptions.position);
      expect(result.type).toBe(minimalOptions.type);
      expect(result.orderId).toBeUndefined();
      expect(result.size).toBeUndefined();
      expect(result.price).toBeUndefined();
      expect(result.fee).toBeUndefined();
    });
  });

  describe('updateTradeOrder', () => {
    let createdOrder: TradeOrderDocument;

    beforeEach(async () => {
      const createOptions: CreateTradeOrderOptions = {
        status: TradeOrderStatus.CREATED,
        position: new Types.ObjectId().toString(),
        type: 'MARKET',
        orderId: 'order123',
        size: 100,
      };

      createdOrder = await service.createTradeOrder(createOptions);
    });

    it('should update a trade order', async () => {
      const mockUpdateOptions: UpdateTradeOrderOptions = {
        status: TradeOrderStatus.COMPLETED,
        price: 51000,
        fee: 10,
      };

      const result = await service.updateTradeOrder(
        String(createdOrder._id),
        mockUpdateOptions,
      );

      expect(result).toBeDefined();
      if (result) {
        expect(result.status).toBe(TradeOrderStatus.COMPLETED);
        expect(result.price).toBe(mockUpdateOptions.price);
        expect(result.fee).toBe(mockUpdateOptions.fee);
        expect(result.orderId).toBe(createdOrder.orderId);
        expect(result.size).toBe(createdOrder.size);
      }
    });

    it('should return null if trade order not found', async () => {
      const nonExistentId = new Types.ObjectId().toString();
      const mockUpdateOptions: UpdateTradeOrderOptions = {
        status: TradeOrderStatus.COMPLETED,
      };

      const result = await service.updateTradeOrder(
        nonExistentId,
        mockUpdateOptions,
      );

      expect(result).toBeNull();
    });
  });

  describe('getByOrderId', () => {
    beforeEach(async () => {
      const orders = [
        {
          status: TradeOrderStatus.CREATED,
          position: new Types.ObjectId().toString(),
          type: 'MARKET',
          orderId: 'order001',
          size: 100,
        },
        {
          status: TradeOrderStatus.PENDING,
          position: new Types.ObjectId().toString(),
          type: 'LIMIT',
          orderId: 'order002',
          size: 200,
        },
        {
          status: TradeOrderStatus.COMPLETED,
          position: new Types.ObjectId().toString(),
          type: 'MARKET',
          orderId: 'order003',
          size: 300,
        },
      ];

      for (const order of orders) {
        await service.createTradeOrder(order);
      }
    });

    it('should return trade order by orderId', async () => {
      const result = await service.getByOrderId('order002');

      expect(result).toBeDefined();
      expect(result?.orderId).toBe('order002');
      expect(result?.status).toBe(TradeOrderStatus.PENDING);
      expect(result?.size).toBe(200);
    });

    it('should return null if orderId not found', async () => {
      const result = await service.getByOrderId('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('updateByOrderId', () => {
    beforeEach(async () => {
      const orders = [
        {
          status: TradeOrderStatus.CREATED,
          position: new Types.ObjectId().toString(),
          type: 'MARKET',
          orderId: 'order100',
          size: 100,
          price: 50000,
        },
        {
          status: TradeOrderStatus.PENDING,
          position: new Types.ObjectId().toString(),
          type: 'LIMIT',
          orderId: 'order200',
          size: 200,
        },
      ];

      for (const order of orders) {
        await service.createTradeOrder(order);
      }
    });

    it('should update trade order by orderId', async () => {
      const mockUpdateOptions: UpdateTradeOrderOptions = {
        status: TradeOrderStatus.COMPLETED,
        price: 51000,
        fee: 15,
      };

      const result = await service.updateByOrderId('order100', mockUpdateOptions);

      expect(result).toBeDefined();
      if (result) {
        expect(result.orderId).toBe('order100');
        expect(result.status).toBe(TradeOrderStatus.COMPLETED);
        expect(result.price).toBe(51000);
        expect(result.fee).toBe(15);
        expect(result.size).toBe(100);
      }
    });

    it('should return null if orderId not found', async () => {
      const mockUpdateOptions: UpdateTradeOrderOptions = {
        status: TradeOrderStatus.COMPLETED,
      };

      const result = await service.updateByOrderId(
        'nonexistent',
        mockUpdateOptions,
      );

      expect(result).toBeNull();
    });

    it('should update only specified fields', async () => {
      const mockUpdateOptions: UpdateTradeOrderOptions = {
        fee: 25,
      };

      const result = await service.updateByOrderId('order200', mockUpdateOptions);

      expect(result).toBeDefined();
      if (result) {
        expect(result.orderId).toBe('order200');
        expect(result.status).toBe(TradeOrderStatus.PENDING);
        expect(result.fee).toBe(25);
        expect(result.size).toBe(200);
      }
    });
  });
});
