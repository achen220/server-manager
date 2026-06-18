import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'ssh2';
import { sshConnectionParams } from './server.controller';

@Injectable()
export class ServerService {
  client: Client;
  constructor(private readonly configService: ConfigService) {
    this.client = new Client();
    this.client.on('ready', () => {
      console.log('Client :: ready');
      this.client.exec('uptime', (err, stream) => {
        if (err) throw err;
        stream
          .on('close', (code, signal) => {
            console.log(
              'Stream :: close :: code: ' + code + ', signal: ' + signal,
            );
            this.client.end();
          })
          .on('data', (data) => {
            console.log('STDOUT: ' + data);
          })
          .stderr.on('data', (data) => {
            console.log('STDERR: ' + data);
          });
      });
    });
  }

  remoteConnectionSSH(params: sshConnectionParams): Promise<void> {
    const { host, port, username, password } = params;

    return new Promise((resolve, reject) => {
      this.client
        .on('ready', () => {
          console.log('SSH connection successful');
          resolve();
        })
        .on('error', (err) => {
          console.error('SSH connection failed:', err.message);
          reject(err);
        })
        .connect({
          host,
          port,
          username,
          password,
        });
    });
  }
}
