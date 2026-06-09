import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { ConnectionsService } from './connections.service';
import { CreateConnectionDto } from './create-connection.dto';

interface AuthRequest {
  user: JwtPayload;
}

@Controller('connections')
@UseGuards(JwtAuthGuard)
export class ConnectionsController {
  constructor(private readonly svc: ConnectionsService) {}

  @Get()
  findAll(@Request() req: AuthRequest) {
    return this.svc.findAll(req.user.sub);
  }

  @Post()
  create(@Body() dto: CreateConnectionDto, @Request() req: AuthRequest) {
    return this.svc.create(dto, req.user.sub);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: CreateConnectionDto,
    @Request() req: AuthRequest,
  ) {
    return this.svc.update(id, dto, req.user.sub);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.svc.remove(id, req.user.sub);
  }
}
