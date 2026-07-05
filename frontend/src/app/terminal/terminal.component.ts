import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { io, Socket } from 'socket.io-client';
import { SupabaseService } from '../core/supabase.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-terminal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule],
  templateUrl: './terminal.component.html',
  styleUrl: './terminal.component.scss',
})
export class TerminalComponent implements AfterViewInit, OnDestroy {
  @ViewChild('termContainer') private termContainer!: ElementRef<HTMLDivElement>;

  private readonly router = inject(Router);
  private readonly supabase = inject(SupabaseService);

  id = input<string>('');
  name = input<string>('Server');

  status = signal<'connecting' | 'connected' | 'error' | 'closed'>('connecting');

  private term!: Terminal;
  private fitAddon!: FitAddon;
  private socket!: Socket;
  private resizeObserver?: ResizeObserver;

  async ngAfterViewInit(): Promise<void> {
    const session = await this.supabase.getSession();
    if (!session) {
      this.router.navigate(['/login']);
      return;
    }

    this.term = new Terminal({
      cursorBlink: true,
      fontFamily: '"Cascadia Code", "JetBrains Mono", "Fira Code", monospace',
      fontSize: 14,
      theme: { background: '#1e1e1e', foreground: '#d4d4d4' },
      scrollback: 5000,
    });

    this.fitAddon = new FitAddon();
    this.term.loadAddon(this.fitAddon);
    this.term.open(this.termContainer.nativeElement);
    this.fitAddon.fit();

    const socketBase = environment.apiUrl.replace('/api', '');
    this.socket = io(`${socketBase}/terminal`, {
      auth: { token: session.access_token },
      transports: ['websocket'],
    });

    this.socket.on('connect', () => {
      this.status.set('connected');
      this.socket.emit('start-shell', { cols: this.term.cols, rows: this.term.rows });
    });

    this.socket.on('output', (data: string) => {
      this.term.write(data);
    });

    this.socket.on('shell-closed', () => {
      this.status.set('closed');
      this.term.write('\r\n\x1b[33mConnection closed.\x1b[0m\r\n');
    });

    this.socket.on('error', (msg: string) => {
      this.status.set('error');
      this.term.write(`\r\n\x1b[31mError: ${msg}\x1b[0m\r\n`);
    });

    this.socket.on('auth-error', () => {
      this.router.navigate(['/login']);
    });

    this.socket.on('connect_error', () => {
      this.status.set('error');
    });

    this.socket.on('disconnect', () => {
      this.status.set('closed');
    });

    this.term.onData((data) => {
      if (this.socket.connected) this.socket.emit('input', data);
    });

    this.resizeObserver = new ResizeObserver(() => {
      this.fitAddon.fit();
      this.socket.emit('resize', { cols: this.term.cols, rows: this.term.rows });
    });
    this.resizeObserver.observe(this.termContainer.nativeElement);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.socket?.disconnect();
    this.term?.dispose();
  }

  disconnect(): void {
    this.router.navigate(['/connections']);
  }
}
