import { Module } from '@nestjs/common';
import { ServerModule } from '../server/service.module';
import { TerminalGateway } from './terminal.gateway';

@Module({
  imports: [ServerModule],
  providers: [TerminalGateway],
})
export class TerminalModule {}
