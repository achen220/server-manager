import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';

@Component({
  selector: 'app-terminal',
  standalone: true,
  imports: [ButtonModule, CardModule],
  templateUrl: './terminal.component.html',
  styleUrl: './terminal.component.scss',
})
export class TerminalComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  connectionId = '';
  connectionName = '';

  ngOnInit(): void {
    this.connectionId = this.route.snapshot.paramMap.get('id') ?? '';
    this.connectionName =
      this.route.snapshot.queryParamMap.get('name') ?? 'Server';
  }

  disconnect(): void {
    this.router.navigate(['/connections']);
  }
}
