import { Module } from '@nestjs/common';
import { ConnectionsModule } from '../connections/connections.module';
import { ServerController } from './server.controller';
import { ServerService } from './server.service';
import { SambaService } from './services/samba.services';
@Module({
  imports: [ConnectionsModule],
  controllers: [ServerController],
  providers: [ServerService, SambaService],
  exports: [ServerService],
})
export class ServerModule {}
