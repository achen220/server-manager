import { BadRequestException, Injectable } from '@nestjs/common';
import { ServerService } from '../server/server.service';

export interface SystemOverview {
  hostname: string;
  uptime: string;
  os: string;
  kernel: string;
  arch: string;
  loadAvg: { load1: string; load5: string; load15: string };
}

export interface ResourceUsage {
  cpu: { usedPercent: number };
  ram: {
    total: number;
    used: number;
    available: number;
    usedPercent: number;
  };
  disk: {
    total: number;
    used: number;
    available: number;
    usedPercent: number;
  };
}

export interface ProcessInfo {
  user: string;
  pid: number;
  cpu: number;
  mem: number;
  rss: number;
  stat: string;
  start: string;
  time: string;
  command: string;
}

export interface ServiceInfo {
  unit: string;
  load: string;
  active: string;
  sub: string;
  description: string;
}

@Injectable()
export class MonitoringService {
  constructor(private readonly serverService: ServerService) {}

  async getSystemOverview(userId: string): Promise<SystemOverview> {
    // Single exec — 6 lines in order: hostname, uptime, os, kernel, arch, loadavg
    const output = await this.serverService.runCommand(
      userId,
      [
        'hostname',
        "uptime -p 2>/dev/null || uptime",
        "grep '^PRETTY_NAME' /etc/os-release 2>/dev/null | cut -d= -f2 | tr -d '\"' || uname -s",
        'uname -r',
        'uname -m',
        "awk '{print $1\",\"$2\",\"$3}' /proc/loadavg",
      ].join('; '),
    );
    const [hostname, uptime, os, kernel, arch, loadAvg] = output
      .trim()
      .split('\n');
    const [load1, load5, load15] = (loadAvg ?? '').split(',');
    return {
      hostname: hostname?.trim() ?? '',
      uptime: uptime?.trim() ?? '',
      os: os?.trim() ?? '',
      kernel: kernel?.trim() ?? '',
      arch: arch?.trim() ?? '',
      loadAvg: {
        load1: load1 ?? '-',
        load5: load5 ?? '-',
        load15: load15 ?? '-',
      },
    };
  }

  async getResourceUsage(userId: string): Promise<ResourceUsage> {
    // Single exec — sections delimited by sentinel lines
    const output = await this.serverService.runCommand(
      userId,
      "free -b && echo '===DF===' && df -B1 / && echo '===CPU===' && awk '/^cpu / {idle=$5; total=0; for(i=2;i<=NF;i++) total+=$i; printf \"%.1f\\n\", (1-idle/total)*100}' /proc/stat",
    );

    const [freePart = '', rest = ''] = output.split('===DF===');
    const [dfPart = '', cpuPart = ''] = rest.split('===CPU===');

    // Parse RAM
    const memLine = freePart
      .trim()
      .split('\n')
      .find((l) => l.startsWith('Mem:'));
    const mem = memLine?.trim().split(/\s+/) ?? [];
    const ramTotal = Number(mem[1]) || 0;
    const ramUsed = Number(mem[2]) || 0;
    const ramAvailable = Number(mem[6]) || Number(mem[3]) || 0;

    // Parse disk
    const diskLine = dfPart.trim().split('\n')[1] ?? '';
    const disk = diskLine.trim().split(/\s+/);
    const diskTotal = Number(disk[1]) || 0;
    const diskUsed = Number(disk[2]) || 0;
    const diskAvail = Number(disk[3]) || 0;

    const cpuPercent = parseFloat(cpuPart.trim()) || 0;

    return {
      cpu: { usedPercent: Math.round(cpuPercent) },
      ram: {
        total: ramTotal,
        used: ramUsed,
        available: ramAvailable,
        usedPercent: ramTotal > 0 ? Math.round((ramUsed / ramTotal) * 100) : 0,
      },
      disk: {
        total: diskTotal,
        used: diskUsed,
        available: diskAvail,
        usedPercent:
          diskTotal > 0 ? Math.round((diskUsed / diskTotal) * 100) : 0,
      },
    };
  }

  async getProcesses(userId: string): Promise<ProcessInfo[]> {
    const output = await this.serverService.runCommand(
      userId,
      'ps aux --sort=-%cpu --no-header 2>/dev/null | head -60',
    );
    return output
      .trim()
      .split('\n')
      .filter((l) => l.trim())
      .map((line) => {
        // USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND
        const parts = line.trim().split(/\s+/);
        const [user, pid, cpu, mem, , rss, , stat, start, time, ...cmdParts] =
          parts;
        return {
          user: user ?? '',
          pid: Number(pid),
          cpu: Number(cpu),
          mem: Number(mem),
          rss: Number(rss),
          stat: stat ?? '',
          start: start ?? '',
          time: time ?? '',
          command: cmdParts.join(' '),
        };
      });
  }

  async killProcess(userId: string, pid: number): Promise<void> {
    if (!Number.isInteger(pid) || pid <= 0 || pid > 4_194_304) {
      throw new BadRequestException('Invalid PID');
    }
    await this.serverService.runCommand(userId, `sudo kill -9 ${pid}`);
  }

  async getServices(userId: string): Promise<ServiceInfo[]> {
    const output = await this.serverService.runCommand(
      userId,
      'systemctl list-units --type=service --no-pager --plain --no-legend 2>/dev/null | head -100',
    );
    return output
      .trim()
      .split('\n')
      .filter((l) => l.trim())
      .map((line) => {
        const parts = line.trim().split(/\s+/);
        const [unit, load, active, sub, ...descParts] = parts;
        return {
          unit: unit ?? '',
          load: load ?? '',
          active: active ?? '',
          sub: sub ?? '',
          description: descParts.join(' '),
        };
      });
  }

  async controlService(
    userId: string,
    name: string,
    action: string,
  ): Promise<void> {
    if (!['start', 'stop', 'restart', 'reload'].includes(action)) {
      throw new BadRequestException('Invalid action');
    }
    if (!/^[a-zA-Z0-9_\-\.@:]+$/.test(name)) {
      throw new BadRequestException('Invalid service name');
    }
    await this.serverService.runCommand(
      userId,
      `sudo systemctl ${action} ${name}`,
    );
  }

  async getLogs(userId: string, lines = 200): Promise<string[]> {
    const safeLines = Math.min(Math.max(1, lines), 1000);
    const output = await this.serverService.runCommand(
      userId,
      `journalctl -n ${safeLines} --no-pager --output short-iso 2>/dev/null || tail -n ${safeLines} /var/log/syslog 2>/dev/null || echo "No logs available"`,
    );
    return output.trim().split('\n');
  }
}
