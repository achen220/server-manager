import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ServerService } from './server.service';

export interface sshConnectionParams {
  host: string;
  port: number;
  username: string;
  password: string;
}
@Controller('server')
@UseGuards(JwtAuthGuard)
export class ServerController {
  constructor(private readonly serverService: ServerService) {}

  @Post('ssh-connection')
  sshConnection(@Body() params: sshConnectionParams) {
    this.serverService.remoteConnectionSSH(params);
  }
}
