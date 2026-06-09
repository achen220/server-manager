import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConnectionEntity } from './connection.entity';
import { CreateConnectionDto } from './create-connection.dto';

@Injectable()
export class ConnectionsService {
  constructor(
    @InjectRepository(ConnectionEntity)
    private readonly repo: Repository<ConnectionEntity>,
  ) {}

  findAll(userId: string): Promise<ConnectionEntity[]> {
    return this.repo.find({ where: { userId } });
  }

  async findOne(id: string, userId: string): Promise<ConnectionEntity> {
    const conn = await this.repo.findOne({ where: { id, userId } });
    if (!conn) throw new NotFoundException(`Connection ${id} not found`);
    return conn;
  }

  async create(
    dto: CreateConnectionDto,
    userId: string,
  ): Promise<ConnectionEntity> {
    const conn = this.repo.create({ ...dto, userId });
    return this.repo.save(conn);
  }

  async update(
    id: string,
    dto: CreateConnectionDto,
    userId: string,
  ): Promise<ConnectionEntity> {
    const conn = await this.findOne(id, userId);
    // Only overwrite password if a new one was provided
    if (!dto.password) delete dto.password;
    Object.assign(conn, dto);
    return this.repo.save(conn);
  }

  async remove(id: string, userId: string): Promise<void> {
    const conn = await this.findOne(id, userId);
    await this.repo.remove(conn);
  }

  /** Returns the connection WITH password — for internal SSH use only */
  async getCredentials(id: string, userId: string): Promise<ConnectionEntity> {
    const conn = await this.repo
      .createQueryBuilder('c')
      .addSelect('c.password')
      .where('c.id = :id AND c.userId = :userId', { id, userId })
      .getOne();
    if (!conn) throw new NotFoundException(`Connection ${id} not found`);
    return conn;
  }
}
