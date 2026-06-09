import { Module } from '@nestjs/common';
import { ServerAuthController } from './server-auth.controller';
import { ServerAuthService } from './server-auth.service';

@Module({
  imports: [],
  controllers: [ServerAuthController],
  providers: [ServerAuthService],
})
export class ServerAuthModule {}
