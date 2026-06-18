import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthRequest } from '../connections/connections.controller';
import { ConnectionsService } from '../connections/connections.service';
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
  constructor(
    private readonly serverService: ServerService,
    private readonly connectionService: ConnectionsService,
  ) {}

  @Post('ssh-connection')
  async sshConnection(@Body('id') id: string, @Request() req: AuthRequest) {
    const userId = req.user.sub;
    // this.serverService.remoteConnectionSSH(params?.id);
    console.log({ id, userId });
    const res = await this.connectionService.getCredentials(id, userId);
    const { host, password, port, username } = res;
    const resConnection = await this.serverService.remoteConnectionSSH({
      host,
      password,
      port,
      username,
    });
    console.log({ resConnection });
  }
}
