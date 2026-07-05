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
    const [passwdOutput, whoOutput, lastOutput, sudoOutput] = await Promise.all(
      [
        this.executeCommand(
          `awk -F: '$3 >= 1000 && $3 != 65534 {print $1":"$3":"$4":"$6":"$7}' /etc/passwd`,
        ),
        this.executeCommand('who'),
        this.executeCommand('last -n 50 --time-format iso'),
        this.executeCommand('getent group sudo wheel admin'), // sudo group members
      ],
    );

    // Parse sudo/wheel/admin group members
    const sudoUsers = new Set(
      sudoOutput
        .split('\n')
        .filter((line) => line.trim())
        .flatMap((line) => {
          const members = line.split(':')[3]; // group format: name:pass:gid:members
          return members ? members.split(',') : [];
        }),
    );

    const loggedInUsers = new Set(
      whoOutput
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => line.trim().split(/\s+/)[0]),
    );

    const lastLogins = lastOutput
      .split('\n')
      .filter(
        (line) =>
          line.trim() && !line.startsWith('reboot') && !line.startsWith('wtmp'),
      )
      .reduce(
        (acc, line) => {
          const parts = line.trim().split(/\s+/);
          const username = parts[0];
          if (!acc[username]) acc[username] = parts[3];
          return acc;
        },
        {} as Record<string, string>,
      );

    return passwdOutput
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        const [username, uid, gid, home, shell] = line.split(':');
        return {
          username,
          uid: Number(uid),
          gid: Number(gid),
          home,
          shell,
          isActive: loggedInUsers.has(username),
          lastLogin: lastLogins[username] ?? null,
          isAdmin: sudoUsers.has(username),
          hasValidShell: ![
            '/sbin/nologin',
            '/bin/false',
            '/usr/sbin/nologin',
          ].includes(shell),
        };
      })
      .filter((u) => u.hasValidShell);
  }

  async addSshUser(username: string, password: string, isAdmin: boolean) {
    // Create user with home dir and bash shell
    await this.executeCommand(`sudo useradd -m -s /bin/bash ${username}`);

    // Set password (pipe via stdin)
    await this.executeCommand(`echo "${username}:${password}" | sudo chpasswd`);

    // Add to sudo group if admin
    if (isAdmin) {
      await this.executeCommand(`sudo usermod -aG sudo ${username}`);
    }

    return { success: true, username };
  }
}
