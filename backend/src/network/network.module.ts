import { Module } from '@nestjs/common';
import { ServerModule } from '../server/service.module';
import { NetworkController } from './network.controller';
import { NetworkService } from './network.service';

@Module({
  imports: [ServerModule],
  controllers: [NetworkController],
  providers: [NetworkService],
})
export class NetworkModule {}
