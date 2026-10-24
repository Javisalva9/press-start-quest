import { Module } from '@nestjs/common';
import { GamerPowerModule } from '../providers/gamerpower/gamerpower.module.js';
import { ItadModule } from '../providers/itad/itad.module.js';
import { DealsController } from './deals.controller.js';
import { DealsService } from './deals.service.js';
import { FreeGamesService } from './free-games.service.js';
import { PricesService } from './prices.service.js';

/**
 * Prices and deals of the games players want (IsThereAnyDeal), and the
 * free games of the week (GamerPower).
 */
@Module({
  imports: [ItadModule, GamerPowerModule],
  controllers: [DealsController],
  providers: [PricesService, DealsService, FreeGamesService],
  exports: [PricesService, FreeGamesService],
})
export class DealsModule {}
