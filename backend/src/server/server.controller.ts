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
  password?: string;
  privateKey?: string;
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
    const { host, port, username, authType, password, privateKey } = res;
    await this.serverService.remoteConnectionSSH(userId, {
      host,
      port,
      username,
      ...(authType === 'key'
        ? { privateKey: privateKey ?? '' }
        : { password: password ?? '' }),
    });
  }

  @Get('ssh-users')
  async sshUsers(@Request() req: AuthRequest) {
    return await this.serverService.sshUsers(req.user.sub);
  }

  @Post('add-ssh-user')
  async addSshUser(@Body() body: AddSshUserDto, @Request() req: AuthRequest) {
    return await this.serverService.addSshUser(
      req.user.sub,
      body.username,
      body.password,
      body.isAdmin,
    );
  }
}
