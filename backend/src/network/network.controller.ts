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
import { NetworkService } from './network.service';

@Controller('network')
@UseGuards(JwtAuthGuard)
export class NetworkController {
  constructor(private readonly networkService: NetworkService) {}

  @Get('interfaces')
  getInterfaces(@Request() req: AuthRequest) {
    return this.networkService.getInterfaces(req.user.sub);
  }

  @Get('ports')
  getPorts(@Request() req: AuthRequest) {
    return this.networkService.getPorts(req.user.sub);
  }

  @Get('firewall')
  getFirewallRules(@Request() req: AuthRequest) {
    return this.networkService.getFirewallRules(req.user.sub);
  }

  @Post('firewall')
  addFirewallRule(
    @Body('rule') rule: string,
    @Body('action') action: 'allow' | 'deny',
    @Request() req: AuthRequest,
  ) {
    return this.networkService.addFirewallRule(req.user.sub, rule, action);
  }

  @Delete('firewall/:num')
  deleteFirewallRule(
    @Param('num') num: string,
    @Request() req: AuthRequest,
  ) {
    return this.networkService.deleteFirewallRule(
      req.user.sub,
      parseInt(num, 10),
    );
  }

  @Get('dns')
  getDnsConfig(@Request() req: AuthRequest) {
    return this.networkService.getDnsConfig(req.user.sub);
  }
}
