import { Module } from '@nestjs/common';
import { ItadModule } from '../providers/itad/itad.module.js';
import { PricesService } from './prices.service.js';

/** Prices and deals of the games players want, from IsThereAnyDeal. */
@Module({
  imports: [ItadModule],
  providers: [PricesService],
  exports: [PricesService],
})
export class DealsModule {}
