import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Perp, PerpSchema } from './Perp.schema';
import { PerpService } from './Perp.service';
import { PerpRepository } from './Perp.repository';
import { PerpPriceMonitorService } from './PerpPriceMonitor.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Perp.name, schema: PerpSchema }]),
  ],
  providers: [PerpService, PerpRepository, PerpPriceMonitorService],
  exports: [PerpService, PerpPriceMonitorService],
})
export class PerpModule {}
