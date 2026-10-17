import { Module } from '@nestjs/common';
import { FinaleResolver } from './finale-resolver.js';

/** Which achievements mark the end of a game: rules plus votes. */
@Module({
  providers: [FinaleResolver],
  exports: [FinaleResolver],
})
export class FinaleModule {}
