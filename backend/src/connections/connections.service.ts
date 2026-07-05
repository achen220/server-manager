import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConnectionEntity } from './connection.entity';
import { CreateConnectionDto } from './create-connection.dto';
import { EncryptionService } from './encryption.service';

@Injectable()
export class ConnectionsService {
  constructor(
    @InjectRepository(ConnectionEntity)
    private readonly repo: Repository<ConnectionEntity>,
    private readonly encryption: EncryptionService,
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
    const data = { ...dto, userId };
    if (data.password) {
      data.password = this.encryption.encrypt(data.password);
    }
    if (data.privateKey) {
      data.privateKey = this.encryption.encrypt(data.privateKey);
    }
    const conn = this.repo.create(data);
    return this.repo.save(conn);
  }

  async update(
    id: string,
    dto: CreateConnectionDto,
    userId: string,
  ): Promise<ConnectionEntity> {
    const conn = await this.findOne(id, userId);
    if (!dto.password) {
      delete dto.password;
    } else {
      dto.password = this.encryption.encrypt(dto.password);
    }
    if (!dto.privateKey) {
      delete dto.privateKey;
    } else {
      dto.privateKey = this.encryption.encrypt(dto.privateKey);
    }
    Object.assign(conn, dto);
    return this.repo.save(conn);
  }

  async remove(id: string, userId: string): Promise<void> {
    const conn = await this.findOne(id, userId);
    await this.repo.remove(conn);
  }

  /** Returns the connection WITH decrypted password — for internal SSH use only */
  async getCredentials(id: string, userId: string): Promise<ConnectionEntity> {
    const conn = await this.repo
      .createQueryBuilder('c')
      .addSelect('c.password')
      .addSelect('c.privateKey')
      .where('c.id = :id AND c.userId = :userId', { id, userId })
      .getOne();
    if (!conn) throw new NotFoundException(`Connection ${id} not found`);
    if (conn.password) {
      conn.password = this.encryption.decrypt(conn.password);
    }
    if (conn.privateKey) {
      try {
        conn.privateKey = this.encryption.decrypt(conn.privateKey);
      } catch {
        conn.privateKey = undefined;
      }
    }
    return conn;
  }
}
