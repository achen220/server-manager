import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthRequest } from '../connections/connections.controller';
import { MonitoringService } from './monitoring.service';

@Controller('monitor')
@UseGuards(JwtAuthGuard)
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get('overview')
  getSystemOverview(@Request() req: AuthRequest) {
    return this.monitoringService.getSystemOverview(req.user.sub);
  }

  @Get('resources')
  getResourceUsage(@Request() req: AuthRequest) {
    return this.monitoringService.getResourceUsage(req.user.sub);
  }

  @Get('processes')
  getProcesses(@Request() req: AuthRequest) {
    return this.monitoringService.getProcesses(req.user.sub);
  }

  @Post('processes/kill')
  killProcess(@Body('pid') pid: number, @Request() req: AuthRequest) {
    return this.monitoringService.killProcess(req.user.sub, Number(pid));
  }

  @Get('services')
  getServices(@Request() req: AuthRequest) {
    return this.monitoringService.getServices(req.user.sub);
  }

  @Post('services/:name/:action')
  controlService(
    @Param('name') name: string,
    @Param('action') action: string,
    @Request() req: AuthRequest,
  ) {
    return this.monitoringService.controlService(req.user.sub, name, action);
  }

  @Get('logs')
  getLogs(@Query('lines') lines: string, @Request() req: AuthRequest) {
    return this.monitoringService.getLogs(
      req.user.sub,
      lines ? parseInt(lines, 10) : 200,
    );
  }
}
