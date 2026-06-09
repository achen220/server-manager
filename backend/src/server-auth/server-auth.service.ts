import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'ssh2';
@Injectable()
export class ServerAuthService {
  client: Client;
  constructor(private readonly configService: ConfigService) {
    this.client = new Client();
    this.client
      .on('ready', () => {
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
      })
      .connect({
        host: this.configService.get('hostName'),
        port: this.configService.get('port'),
        username: this.configService.get('username'),
        password: this.configService.get('password'),
      });
  }

  // remoteConnectionSSH() {
  //   this.client.connect({
  //     host: '',
  //     port: 24,
  //     username: '',
  //     password: '',
  //   });
  // }
}
