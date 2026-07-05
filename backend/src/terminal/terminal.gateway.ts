import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { JwksClient } from 'jwks-rsa';
import { verify } from 'jsonwebtoken';
import type { JwtHeader, SigningKeyCallback } from 'jsonwebtoken';
import { ServerService } from '../server/server.service';

@WebSocketGateway({
  cors: { origin: 'http://localhost:4200', credentials: true },
  namespace: '/terminal',
})
export class TerminalGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(TerminalGateway.name);
  private readonly shells = new Map<string, any>();

  constructor(
    private readonly serverService: ServerService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = client.handshake.auth?.['token'] as string | undefined;
      if (!token) throw new Error('Missing token');
      const userId = await this.verifyJwt(token);
      client.data['userId'] = userId;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Auth failed';
      this.logger.warn(`Terminal WS rejected [${client.id}]: ${msg}`);
      client.emit('auth-error', 'Authentication failed');
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const stream = this.shells.get(client.id);
    if (stream) {
      stream.end?.();
      this.shells.delete(client.id);
    }
  }

  @SubscribeMessage('start-shell')
  startShell(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { cols: number; rows: number },
  ): void {
    const userId = client.data['userId'] as string;
    const sshClient = this.serverService.getClientPublic(userId);
    if (!sshClient) {
      client.emit(
        'error',
        'No active SSH connection. Connect to the server first.',
      );
      return;
    }

    sshClient.shell(
      {
        term: 'xterm-256color',
        cols: data?.cols ?? 80,
        rows: data?.rows ?? 24,
      },
      (err: Error | undefined, stream: any) => {
        if (err) {
          client.emit('error', err.message);
          return;
        }
        this.shells.set(client.id, stream);

        stream.on('data', (chunk: Buffer) => {
          client.emit('output', chunk.toString('binary'));
        });
        stream.stderr?.on('data', (chunk: Buffer) => {
          client.emit('output', chunk.toString('binary'));
        });
        stream.on('close', () => {
          this.shells.delete(client.id);
          client.emit('shell-closed');
        });
      },
    );
  }

  @SubscribeMessage('input')
  handleInput(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: string,
  ): void {
    this.shells.get(client.id)?.write(data);
  }

  @SubscribeMessage('resize')
  handleResize(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { cols: number; rows: number },
  ): void {
    this.shells.get(client.id)?.setWindow?.(data.rows, data.cols, 0, 0);
  }

  private verifyJwt(token: string): Promise<string> {
    const supabaseUrl = this.config.getOrThrow<string>('SUPABASE_URL');
    const client = new JwksClient({
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 10,
      jwksUri: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
    });

    return new Promise((resolve, reject) => {
      verify(
        token,
        (header: JwtHeader, callback: SigningKeyCallback) => {
          client.getSigningKey(header.kid, (err: any, key: any) => {
            if (err) return callback(err);
            callback(null, key.getPublicKey());
          });
        },
        { audience: 'authenticated' },
        (err: Error | null, decoded: any) => {
          if (err) return reject(err);
          resolve(decoded.sub as string);
        },
      );
    });
  }
}
