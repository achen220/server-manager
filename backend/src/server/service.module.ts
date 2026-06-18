import { Module } from '@nestjs/common';
import { ConnectionsModule } from '../connections/connections.module';
import { ServerController } from './server.controller';
import { ServerService } from './server.service';
@Module({
  imports: [ConnectionsModule],
  controllers: [ServerController],
  providers: [ServerService],
})
export class ServerModule {}
