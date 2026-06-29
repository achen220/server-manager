import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'ssh2';
import { sshConnectionParams } from './server.controller';
import { SambaService } from './services/samba.services';

@Injectable()
export class ServerService {
  client: Client;

  constructor(
    private readonly configService: ConfigService,
    private readonly sambaService: SambaService,
  ) {
    this.client = new Client();
    this.client.on('ready', () => {
      console.log('Client :: ready');
      this.client.exec('uptime', (err, stream) => {
        if (err) throw err;
        stream
          .on('close', (code: string, signal: string) => {
            console.log(
              'Stream :: close :: code: ' + code + ', signal: ' + signal,
            );
          })
          .on('data', (data: string) => {
            console.log('STDOUT: ' + data);
          })
          .stderr.on('data', (data) => {
            console.log('STDERR: ' + data);
          });
      });
    });
  }

  private executeCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.client.exec(command, (err, stream) => {
        if (err) return reject(err);

        let stdout = '';
        let stderr = '';

        stream
          .on('close', (code: number) => {
            console.log('closing');
            if (code !== 0 && stderr) {
              return reject(new Error(stderr));
            }
            resolve(stdout);
          })
          .on('data', (data: Buffer) => {
            console.log(`Executing commands: ${command}`);
            stdout += data.toString();
          })
          .stderr.on('data', (data: Buffer) => {
            console.log('Command failed on execution');
            stderr += data.toString();
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

  async sshUsers() {
    const output = await this.executeCommand('who');
    console.log({ output });
    return output
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        const parts = line.trim().split(/\s+/);
        return {
          username: parts[0],
          type: parts[1],
          terminal: parts[2] || null,
          loginTime: `${parts[3]} ${parts[4]}`,
          ip: parts[5]?.replace(/[()]/g, '') || null,
        };
      });
  }

  // async sambaOnlineUser() {
  //   const output = await this.executeCommand('sudo smbstatus -p');

  //   console.log({ output });
  //   // return this.parseOnlineUsers(output);
  //   const result = this.parseOnlineUsers(output);
  //   console.log({ result });
  //   return result;
  // }

  // private parseOnlineUsers(output: string): any[] {
  //   const users = [];
  //   const lines = output.split('\n');

  //   // Find the header separator line (dashes), then parse rows after it
  //   let dataStarted = false;

  //   for (const line of lines) {
  //     if (!dataStarted) {
  //       if (line.startsWith('----') || line.startsWith('PID')) {
  //         dataStarted = true;
  //         continue;
  //       }
  //       // Skip header dashes line itself
  //       if (dataStarted && line.startsWith('----')) continue;
  //     }

  //     if (dataStarted && line.trim()) {
  //       const parts = line.trim().split(/\s+/);
  //       if (parts.length >= 4 && /^\d+$/.test(parts[0])) {
  //         users.push({
  //           pid: parts[0],
  //           username: parts[1],
  //           group: parts[2],
  //           machine: parts[3],
  //           protocolVersion: parts[4] || '',
  //           encryptionKey: parts[5] || '',
  //           connectionTime: parts.slice(6).join(' ') || undefined,
  //         });
  //       }
  //     }
  //   }

  //   return users;
  // }
}
