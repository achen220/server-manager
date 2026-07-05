import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthRequest } from '../connections/connections.controller';
import { ConnectionsService } from '../connections/connections.service';
import { AddSshUserDto } from '../types/AddSshUser.dto';
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

    const res = await this.connectionService.getCredentials(id, userId);
    const { host, password, port, username } = res;
    const resConnection = await this.serverService.remoteConnectionSSH({
      host,
      password: password ?? '',
      port,
      username,
    });
    console.log({ resConnection });
  }

  @Get('ssh-users')
  async sshUsers() {
    return await this.serverService.sshUsers();
  }

  @Post('add-ssh-user')
  async addSshUser(@Body() body: AddSshUserDto) {
    return await this.serverService.addSshUser(
      body.username,
      body.password,
      body.isAdmin,
    );
  }
}
