import { BadRequestException, Injectable } from '@nestjs/common';
import { ServerService } from '../server/server.service';

export interface NetworkInterface {
  name: string;
  index: number;
  state: 'up' | 'down' | 'unknown';
  mac: string;
  mtu: number;
  flags: string[];
  addresses: { family: string; address: string; prefix: number; broadcast?: string }[];
}

export interface PortInfo {
  protocol: string;
  state: string;
  address: string;
  port: number;
  process: string;
  pid: number;
}

export interface FirewallStatus {
  active: boolean;
  rules: FirewallRule[];
}

export interface FirewallRule {
  num: number;
  to: string;
  action: string;
  from: string;
}

export interface DnsConfig {
  nameservers: string[];
  search: string[];
  raw: string;
}

@Injectable()
export class NetworkService {
  constructor(private readonly serverService: ServerService) {}

  async getInterfaces(userId: string): Promise<NetworkInterface[]> {
    const output = await this.serverService.runCommand(
      userId,
      'ip -j addr show 2>/dev/null',
    );
    try {
      type AddrInfo = {
        family: string;
        local: string;
        prefixlen: number;
        broadcast?: string;
      };
      type IpEntry = {
        ifindex: number;
        ifname: string;
        flags?: string[];
        mtu?: number;
        operstate?: string;
        address?: string;
        addr_info?: AddrInfo[];
      };
      const entries: IpEntry[] = JSON.parse(output.trim());
      return entries.map((e) => ({
        name: e.ifname,
        index: e.ifindex,
        state:
          (e.flags?.includes('UP') ? 'up' : 'down') as NetworkInterface['state'],
        mac: e.address ?? '',
        mtu: e.mtu ?? 0,
        flags: e.flags ?? [],
        addresses: (e.addr_info ?? []).map((a) => ({
          family: a.family,
          address: a.local,
          prefix: a.prefixlen,
          broadcast: a.broadcast,
        })),
      }));
    } catch {
      return [];
    }
  }

  async getPorts(userId: string): Promise<PortInfo[]> {
    const output = await this.serverService.runCommand(
      userId,
      'ss -tulnp 2>/dev/null | tail -n +2',
    );
    return output
      .trim()
      .split('\n')
      .filter((l) => l.trim())
      .map((line) => {
        const parts = line.trim().split(/\s+/);
        const [protocol, state, , , localAddr, , ...rest] = parts;
        const processStr = rest.join(' ');
        const lastColon = (localAddr ?? '').lastIndexOf(':');
        const addr = lastColon >= 0 ? localAddr.slice(0, lastColon) : localAddr ?? '';
        const port = lastColon >= 0 ? localAddr.slice(lastColon + 1) : '0';
        const procMatch = processStr.match(/\("([^"]+)",pid=(\d+)/);
        return {
          protocol: protocol ?? '',
          state: state ?? '',
          address: addr,
          port: parseInt(port, 10) || 0,
          process: procMatch?.[1] ?? '',
          pid: parseInt(procMatch?.[2] ?? '0', 10),
        };
      });
  }

  async getFirewallRules(userId: string): Promise<FirewallStatus> {
    const output = await this.serverService.runCommand(
      userId,
      'ufw status numbered 2>/dev/null || echo "UFW_UNAVAILABLE"',
    );
    if (
      output.includes('UFW_UNAVAILABLE') ||
      output.toLowerCase().includes('inactive')
    ) {
      return { active: false, rules: [] };
    }
    const rules: FirewallRule[] = output
      .split('\n')
      .filter((l) => /^\[\s*\d+\]/.test(l))
      .map((line) => {
        const numMatch = line.match(/^\[\s*(\d+)\]\s+(.+)$/);
        if (!numMatch) return null;
        const fields = numMatch[2].split(/\s{2,}/);
        return {
          num: parseInt(numMatch[1], 10),
          to: fields[0]?.trim() ?? '',
          action: fields[1]?.trim() ?? '',
          from: fields[2]?.trim() ?? '',
        } satisfies FirewallRule;
      })
      .filter((r): r is FirewallRule => r !== null);
    return { active: true, rules };
  }

  async addFirewallRule(
    userId: string,
    rule: string,
    action: 'allow' | 'deny',
  ): Promise<void> {
    if (!['allow', 'deny'].includes(action)) {
      throw new BadRequestException('Invalid action');
    }
    // rule: only allow alphanumeric, /, space, : (for port ranges and protocols)
    if (!/^[a-zA-Z0-9\/:\s]+$/.test(rule.trim())) {
      throw new BadRequestException('Invalid firewall rule format');
    }
    await this.serverService.runCommand(
      userId,
      `sudo ufw ${action} ${rule.trim()}`,
    );
  }

  async deleteFirewallRule(userId: string, ruleNum: number): Promise<void> {
    if (!Number.isInteger(ruleNum) || ruleNum <= 0) {
      throw new BadRequestException('Invalid rule number');
    }
    await this.serverService.runCommand(
      userId,
      `echo y | sudo ufw delete ${ruleNum}`,
    );
  }

  async getDnsConfig(userId: string): Promise<DnsConfig> {
    const output = await this.serverService.runCommand(
      userId,
      'cat /etc/resolv.conf 2>/dev/null || echo "# resolv.conf not found"',
    );
    const lines = output.split('\n');
    return {
      nameservers: lines
        .filter((l) => l.trim().startsWith('nameserver'))
        .map((l) => l.replace(/^nameserver\s+/, '').trim()),
      search: lines
        .filter((l) => l.trim().startsWith('search'))
        .map((l) => l.replace(/^search\s+/, '').trim()),
      raw: output,
    };
  }

  async enableUfw(userId: string): Promise<void> {
    // Allow SSH first to prevent lockout, then force-enable UFW
    await this.serverService.runCommand(
      userId,
      'sudo ufw allow 22/tcp && sudo ufw --force enable',
    );
  }
}
