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
  Platform,
  TradePositionStatus,
  Currency,
  PositionType,
} from '../../shared';
import { Types } from 'mongoose';
import { TradeOrderDocument } from './TradeOrder.schema';
import { TradeOrderModule } from './TradeOrder.module';
import { OrderFill, OrderUpdate } from '../../infrastructure/websocket';
import { TradePositionService } from '../trade-position/TradePosition.service';

describe('TradeOrderService', () => {
  let service: TradeOrderService;
  let positionService: TradePositionService;
  let mongoDbTestingService: MongoDbTestingService;
  let module: TestingModule;

  beforeEach(async () => {
    module = await createTestingModuleWithProviders({
      imports: [TradeOrderModule, MongoDbTestingModule],
    }).compile();

    service = module.get(TradeOrderService);
    positionService = module.get(TradePositionService);
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
        status: TradeOrderStatus.CREATED,
        position: new Types.ObjectId().toString(),
        type: 'LIMIT',
      };

      const result = await service.createTradeOrder(minimalOptions);

      expect(result).toBeDefined();
      expect(result.status).toBe(TradeOrderStatus.CREATED);
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
        status: TradeOrderStatus.EXECUTED,
        price: 51000,
        fee: 10,
      };

      const result = await service.updateTradeOrder(
        String(createdOrder._id),
        mockUpdateOptions,
      );

      expect(result).toBeDefined();
      if (result) {
        expect(result.status).toBe(TradeOrderStatus.EXECUTED);
        expect(result.price).toBe(mockUpdateOptions.price);
        expect(result.fee).toBe(mockUpdateOptions.fee);
        expect(result.orderId).toBe(createdOrder.orderId);
        expect(result.size).toBe(createdOrder.size);
      }
    });

    it('should return null if trade order not found', async () => {
      const nonExistentId = new Types.ObjectId().toString();
      const mockUpdateOptions: UpdateTradeOrderOptions = {
        status: TradeOrderStatus.EXECUTED,
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
          status: TradeOrderStatus.CREATED,
          position: new Types.ObjectId().toString(),
          type: 'LIMIT',
          orderId: 'order002',
          size: 200,
        },
        {
          status: TradeOrderStatus.EXECUTED,
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
      expect(result?.status).toBe(TradeOrderStatus.CREATED);
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
          status: TradeOrderStatus.CREATED,
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
        status: TradeOrderStatus.EXECUTED,
        price: 51000,
        fee: 15,
      };

      const result = await service.updateByOrderId(
        'order100',
        mockUpdateOptions,
      );

      expect(result).toBeDefined();
      if (result) {
        expect(result.orderId).toBe('order100');
        expect(result.status).toBe(TradeOrderStatus.EXECUTED);
        expect(result.price).toBe(51000);
        expect(result.fee).toBe(15);
        expect(result.size).toBe(100);
      }
    });

    it('should return null if orderId not found', async () => {
      const mockUpdateOptions: UpdateTradeOrderOptions = {
        status: TradeOrderStatus.EXECUTED,
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

      const result = await service.updateByOrderId(
        'order200',
        mockUpdateOptions,
      );

      expect(result).toBeDefined();
      if (result) {
        expect(result.orderId).toBe('order200');
        expect(result.status).toBe(TradeOrderStatus.CREATED);
        expect(result.fee).toBe(25);
        expect(result.size).toBe(200);
      }
    });
  });

  describe('handleOrderFill', () => {
    let positionId: string;

    beforeEach(async () => {
      // Create a test position
      const position = await positionService.createTradePosition({
        platform: Platform.HYPERLIQUID,
        status: TradePositionStatus.CREATED,
        positionType: PositionType.PERPETUAL,
        token: 'BTC',
        currency: Currency.USDC,
        amountIn: 1000,
      });
      positionId = String(position._id);

      // Create a test order
      const orderOptions: CreateTradeOrderOptions = {
        status: TradeOrderStatus.CREATED,
        position: positionId,
        type: 'MARKET',
        orderId: 'fill-order-123',
      };
      await service.createTradeOrder(orderOptions);
    });

    it('should handle entry order fill and update order', async () => {
      const orderFill: OrderFill = {
        orderId: 'fill-order-123',
        coin: 'BTC',
        side: 'B',
        size: '0.1',
        price: '50000',
        fee: '5',
        timestamp: Date.now(),
        // No closedPnl means entry order
      };

      await service.handleOrderFill(orderFill);

      const updatedOrder = await service.getByOrderId('fill-order-123');
      expect(updatedOrder).toBeDefined();
      expect(updatedOrder?.status).toBe(TradeOrderStatus.EXECUTED);
      expect(updatedOrder?.coin).toBe('BTC');
      expect(updatedOrder?.side).toBe('B');
      expect(updatedOrder?.size).toBe(0.1);
      expect(updatedOrder?.price).toBe(50000);
      expect(updatedOrder?.fee).toBe(5);
      expect(updatedOrder?.timestampFill).toBe(orderFill.timestamp);
    });

    it('should handle entry order fill and set position to OPEN', async () => {
      const orderFill: OrderFill = {
        orderId: 'fill-order-123',
        coin: 'BTC',
        side: 'B',
        size: '0.1',
        price: '50000',
        fee: '5',
        timestamp: Date.now(),
        // No closedPnl means entry order
      };

      await service.handleOrderFill(orderFill);

      const position = await positionService.updateTradePosition(
        positionId,
        {},
      );
      expect(position?.status).toBe(TradePositionStatus.OPEN);
      expect(position?.entryPrice).toBe(50000);
      expect(position?.currentPrice).toBe(50000);
      expect(position?.timeOpened).toBeDefined();
    });

    it('should handle reduce order fill with closedPnl and set position to CLOSED', async () => {
      const orderFill: OrderFill = {
        orderId: 'fill-order-123',
        coin: 'BTC',
        side: 'S',
        size: '0.1',
        price: '52000',
        fee: '5.2',
        timestamp: Date.now(),
        closedPnl: '200', // Has closedPnl means reduce/exit order
      };

      await service.handleOrderFill(orderFill);

      const position = await positionService.updateTradePosition(
        positionId,
        {},
      );
      expect(position?.status).toBe(TradePositionStatus.CLOSED);
      expect(position?.realizedPnl).toBe(200);
      expect(position?.currentPrice).toBe(52000);
      expect(position?.timeClosed).toBeDefined();
    });

    it('should handle order fill with zero closedPnl as entry order', async () => {
      const orderFill: OrderFill = {
        orderId: 'fill-order-123',
        coin: 'BTC',
        side: 'B',
        size: '0.1',
        price: '50000',
        fee: '5',
        timestamp: Date.now(),
        closedPnl: '0', // Zero closedPnl should be treated as entry
      };

      await service.handleOrderFill(orderFill);

      const position = await positionService.updateTradePosition(
        positionId,
        {},
      );
      expect(position?.status).toBe(TradePositionStatus.OPEN);
      expect(position?.entryPrice).toBe(50000);
    });

    it('should handle fill for non-existent order gracefully', async () => {
      const orderFill: OrderFill = {
        orderId: 'non-existent-order',
        coin: 'BTC',
        side: 'B',
        size: '0.1',
        price: '50000',
        fee: '5',
        timestamp: Date.now(),
      };

      // Should not throw
      await expect(service.handleOrderFill(orderFill)).resolves.not.toThrow();
    });
  });

  describe('handleOrderUpdate', () => {
    let positionId: string;

    beforeEach(async () => {
      // Create a test position
      const position = await positionService.createTradePosition({
        platform: Platform.HYPERLIQUID,
        status: TradePositionStatus.CREATED,
        positionType: PositionType.PERPETUAL,
        token: 'ETH',
        currency: Currency.USDC,
        amountIn: 500,
      });
      positionId = String(position._id);

      // Create a test order
      const orderOptions: CreateTradeOrderOptions = {
        status: TradeOrderStatus.CREATED,
        position: positionId,
        type: 'LIMIT',
        orderId: 'update-order-456',
      };
      await service.createTradeOrder(orderOptions);
    });

    it('should handle order update and update order fields', async () => {
      const orderUpdate: OrderUpdate = {
        orderId: 'update-order-456',
        coin: 'ETH',
        side: 'B',
        limitPrice: '3000',
        size: '1.5',
        timestamp: Date.now(),
        originalSize: '2.0',
        clientOrderId: 'client-123',
      };

      await service.handleOrderUpdate(orderUpdate);

      const updatedOrder = await service.getByOrderId('update-order-456');
      expect(updatedOrder).toBeDefined();
      expect(updatedOrder?.coin).toBe('ETH');
      expect(updatedOrder?.side).toBe('B');
      expect(updatedOrder?.limitPrice).toBe(3000);
      expect(updatedOrder?.size).toBe(1.5);
      expect(updatedOrder?.timestampUpdate).toBe(orderUpdate.timestamp);
      expect(updatedOrder?.originalSize).toBe(2.0);
      expect(updatedOrder?.clientOrderId).toBe('client-123');
    });

    it('should handle order update with partial fill', async () => {
      const orderUpdate: OrderUpdate = {
        orderId: 'update-order-456',
        coin: 'ETH',
        side: 'B',
        limitPrice: '3000',
        size: '0.5', // Partially filled
        timestamp: Date.now(),
        originalSize: '2.0',
      };

      await service.handleOrderUpdate(orderUpdate);

      const updatedOrder = await service.getByOrderId('update-order-456');
      expect(updatedOrder?.size).toBe(0.5);
      expect(updatedOrder?.originalSize).toBe(2.0);
    });

    it('should handle update for non-existent order gracefully', async () => {
      const orderUpdate: OrderUpdate = {
        orderId: 'non-existent-order',
        coin: 'ETH',
        side: 'B',
        limitPrice: '3000',
        size: '1.5',
        timestamp: Date.now(),
        originalSize: '2.0',
      };

      // Should not throw
      await expect(
        service.handleOrderUpdate(orderUpdate),
      ).resolves.not.toThrow();
    });
  });
});
