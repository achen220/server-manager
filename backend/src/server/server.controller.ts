import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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

  @Delete('ssh-user/:username')
  async deleteUser(
    @Param('username') username: string,
    @Request() req: AuthRequest,
  ) {
    await this.serverService.deleteUser(req.user.sub, username);
    return { success: true };
  }

  @Post('toggle-admin')
  async toggleAdmin(
    @Body('username') username: string,
    @Body('grant') grant: boolean,
    @Request() req: AuthRequest,
  ) {
    await this.serverService.toggleAdmin(req.user.sub, username, grant);
    return { success: true };
  }

  @Get('authorized-keys/:username')
  async getAuthorizedKeys(
    @Param('username') username: string,
    @Request() req: AuthRequest,
  ) {
    return this.serverService.getAuthorizedKeys(req.user.sub, username);
  }

  @Post('authorized-keys/:username')
  async addAuthorizedKey(
    @Param('username') username: string,
    @Body('publicKey') publicKey: string,
    @Request() req: AuthRequest,
  ) {
    await this.serverService.addAuthorizedKey(req.user.sub, username, publicKey);
    return { success: true };
  }

  @Delete('authorized-keys/:username/:index')
  async removeAuthorizedKey(
    @Param('username') username: string,
    @Param('index') index: string,
    @Request() req: AuthRequest,
  ) {
    await this.serverService.removeAuthorizedKey(
      req.user.sub,
      username,
      parseInt(index, 10),
    );
    return { success: true };
  }

  @Get('groups')
  async getGroups(@Request() req: AuthRequest) {
    return this.serverService.getGroups(req.user.sub);
  }

  @Post('groups/assign')
  async assignUserToGroup(
    @Body('username') username: string,
    @Body('groupName') groupName: string,
    @Body('add') add: boolean,
    @Request() req: AuthRequest,
  ) {
    await this.serverService.assignUserToGroup(
      req.user.sub,
      username,
      groupName,
      add,
    );
    return { success: true };
  }

  @Post('groups')
  async createGroup(
    @Body('groupName') groupName: string,
    @Request() req: AuthRequest,
  ) {
    await this.serverService.createGroup(req.user.sub, groupName);
    return { success: true };
  }

  @Delete('groups/:name')
  async deleteGroup(
    @Param('name') name: string,
    @Request() req: AuthRequest,
  ) {
    await this.serverService.deleteGroup(req.user.sub, name);
    return { success: true };
  }
}
