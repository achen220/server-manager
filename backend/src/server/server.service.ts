import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'ssh2';
import { sshConnectionParams } from './server.controller';
import { SambaService } from './services/samba.services';

@Injectable()
export class ServerService {
  private readonly clients = new Map<string, Client>();

  constructor(
    private readonly configService: ConfigService,
    private readonly sambaService: SambaService,
  ) {}

  private getClient(userId: string): Client {
    const client = this.clients.get(userId);
    if (!client) {
      throw new NotFoundException(
        'No active SSH connection. Please connect first.',
      );
    }
    return client;
  }

  /** Exposed for the WebSocket terminal gateway. */
  getClientPublic(userId: string): Client | undefined {
    return this.clients.get(userId);
  }

  private executeCommand(
    userId: string,
    command: string,
    stdinData?: string,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const client = this.getClient(userId);
      client.exec(command, (err, stream) => {
        if (err) return reject(err);

        let stdout = '';
        let stderr = '';

        if (stdinData) {
          stream.stdin.write(stdinData);
          stream.stdin.end();
        }

        stream
          .on('close', (code: number) => {
            if (code !== 0 && stderr) {
              return reject(new Error(stderr));
            }
            resolve(stdout);
          })
          .on('data', (data: Buffer) => {
            stdout += data.toString();
          })
          .stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
          });
      });
    });
  }

  remoteConnectionSSH(
    userId: string,
    params: sshConnectionParams,
  ): Promise<void> {
    const existing = this.clients.get(userId);
    if (existing) {
      existing.end();
      this.clients.delete(userId);
    }

    return new Promise((resolve, reject) => {
      const client = new Client();
      const { host, port, username, password } = params;

      client
        .on('ready', () => {
          this.clients.set(userId, client);
          resolve();
        })
        .on('error', (err) => {
          this.clients.delete(userId);
          reject(err);
        })
        .on('close', () => {
          this.clients.delete(userId);
        })
        .connect({
          host,
          port,
          username,
          ...(params.privateKey
            ? { privateKey: Buffer.from(params.privateKey) }
            : { password: params.password }),
        });
    });
  }

  async sshUsers(userId: string) {
    const [passwdOutput, whoOutput, lastOutput, sudoOutput] = await Promise.all(
      [
        this.executeCommand(
          userId,
          `awk -F: '$3 >= 1000 && $3 != 65534 {print $1":"$3":"$4":"$6":"$7}' /etc/passwd`,
        ),
        this.executeCommand(userId, 'who'),
        this.executeCommand(userId, 'last -n 50 --time-format iso'),
        this.executeCommand(userId, 'getent group sudo wheel admin'),
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

  async addSshUser(
    userId: string,
    username: string,
    password: string,
    isAdmin: boolean,
  ) {
    if (!/^[a-z_][a-z0-9_-]{0,31}$/.test(username)) {
      throw new BadRequestException('Invalid username format');
    }

    await this.executeCommand(
      userId,
      `sudo useradd -m -s /bin/bash -- ${username}`,
    );
    await this.executeCommand(
      userId,
      `sudo chpasswd`,
      `${username}:${password}\n`,
    );

    if (isAdmin) {
      await this.executeCommand(userId, `sudo usermod -aG sudo -- ${username}`);
    }

    return { success: true, username };
  }

  async deleteUser(userId: string, username: string): Promise<void> {
    if (!/^[a-z_][a-z0-9_-]{0,31}$/.test(username)) {
      throw new BadRequestException('Invalid username format');
    }
    await this.executeCommand(userId, `sudo userdel -r -- ${username}`);
  }

  async toggleAdmin(
    userId: string,
    username: string,
    grant: boolean,
  ): Promise<void> {
    if (!/^[a-z_][a-z0-9_-]{0,31}$/.test(username)) {
      throw new BadRequestException('Invalid username format');
    }
    if (grant) {
      await this.executeCommand(
        userId,
        `sudo usermod -aG sudo -- ${username}`,
      );
    } else {
      await this.executeCommand(userId, `sudo gpasswd -d ${username} sudo`);
    }
  }

  async getAuthorizedKeys(
    userId: string,
    targetUsername: string,
  ): Promise<string[]> {
    if (!/^[a-z_][a-z0-9_-]{0,31}$/.test(targetUsername)) {
      throw new BadRequestException('Invalid username format');
    }
    const keysFile = `/home/${targetUsername}/.ssh/authorized_keys`;
    try {
      const output = await this.executeCommand(
        userId,
        `sudo test -f ${keysFile} && sudo cat ${keysFile} || echo ""`,
      );
      return output
        .split('\n')
        .filter((line) => line.trim() && !line.startsWith('#'));
    } catch {
      return [];
    }
  }

  async addAuthorizedKey(
    userId: string,
    targetUsername: string,
    publicKey: string,
  ): Promise<void> {
    if (!/^[a-z_][a-z0-9_-]{0,31}$/.test(targetUsername)) {
      throw new BadRequestException('Invalid username format');
    }
    const trimmed = publicKey.trim();
    if (
      !/^(ssh-rsa|ssh-ed25519|ecdsa-sha2-nistp\d+|sk-ssh-ed25519@openssh\.com)\s/.test(
        trimmed,
      )
    ) {
      throw new BadRequestException('Invalid SSH public key format');
    }
    const targetDir = `/home/${targetUsername}/.ssh`;
    const keysFile = `${targetDir}/authorized_keys`;
    await this.executeCommand(
      userId,
      `sudo mkdir -p ${targetDir} && sudo chmod 700 ${targetDir} && sudo tee -a ${keysFile} > /dev/null && sudo chmod 600 ${keysFile} && sudo chown -R ${targetUsername}:${targetUsername} ${targetDir}`,
      trimmed + '\n',
    );
  }

  async removeAuthorizedKey(
    userId: string,
    targetUsername: string,
    keyIndex: number,
  ): Promise<void> {
    if (!/^[a-z_][a-z0-9_-]{0,31}$/.test(targetUsername)) {
      throw new BadRequestException('Invalid username format');
    }
    if (!Number.isInteger(keyIndex) || keyIndex < 0) {
      throw new BadRequestException('Invalid key index');
    }
    const keysFile = `/home/${targetUsername}/.ssh/authorized_keys`;
    // sed line numbers are 1-indexed
    await this.executeCommand(
      userId,
      `sudo sed -i '${keyIndex + 1}d' ${keysFile}`,
    );
  }

  async getGroups(
    userId: string,
  ): Promise<Array<{ name: string; gid: number; members: string[] }>> {
    const output = await this.executeCommand(
      userId,
      `getent group | awk -F: '$3 >= 1000 || $1 ~ /^(sudo|wheel|admin|docker|www-data)$/ {print $1":"$3":"$4}'`,
    );
    return output
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        const [name, gidStr, membersStr] = line.split(':');
        return {
          name,
          gid: Number(gidStr),
          members: membersStr
            ? membersStr.split(',').filter((m) => m.trim())
            : [],
        };
      });
  }

  async createGroup(userId: string, groupName: string): Promise<void> {
    if (!/^[a-z_][a-z0-9_-]{0,31}$/.test(groupName)) {
      throw new BadRequestException('Invalid group name format');
    }
    await this.executeCommand(userId, `sudo groupadd -- ${groupName}`);
  }

  async deleteGroup(userId: string, groupName: string): Promise<void> {
    if (!/^[a-z_][a-z0-9_-]{0,31}$/.test(groupName)) {
      throw new BadRequestException('Invalid group name format');
    }
    await this.executeCommand(userId, `sudo groupdel -- ${groupName}`);
  }

  async assignUserToGroup(
    userId: string,
    username: string,
    groupName: string,
    add: boolean,
  ): Promise<void> {
    if (!/^[a-z_][a-z0-9_-]{0,31}$/.test(username)) {
      throw new BadRequestException('Invalid username format');
    }
    if (!/^[a-z_][a-z0-9_-]{0,31}$/.test(groupName)) {
      throw new BadRequestException('Invalid group name format');
    }
    if (add) {
      await this.executeCommand(
        userId,
        `sudo usermod -aG ${groupName} -- ${username}`,
      );
    } else {
      await this.executeCommand(
        userId,
        `sudo gpasswd -d ${username} ${groupName}`,
      );
    }
  }
}
