import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-connections',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div style="padding: 2rem">
      <h1>Connections</h1>
      <p>Your SSH server connections will appear here.</p>
    </div>
  `,
})
export class ConnectionsComponent {}
