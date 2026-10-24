import { Module } from '@nestjs/common';
import { ItadModule } from '../providers/itad/itad.module.js';
import { DealsController } from './deals.controller.js';
import { DealsService } from './deals.service.js';
import { PricesService } from './prices.service.js';

/** Prices and deals of the games players want, from IsThereAnyDeal. */
@Module({
  imports: [ItadModule],
  controllers: [DealsController],
  providers: [PricesService, DealsService],
  exports: [PricesService],
})
export class DealsModule {}
