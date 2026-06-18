import { Component, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-empty-connection',
  standalone: true,
  imports: [ButtonModule],
  template: ` <div class="empty-state">
    <i
      class="pi pi-server"
      style="font-size: 3rem; color: var(--p-text-muted-color)"
    ></i>
    <h3>No connections yet</h3>
    <p>Add your first SSH server to get started</p>
    <p-button
      label="Add Connection"
      icon="pi pi-plus"
      (onClick)="openNew.emit()"
    />
  </div>`,
  styles: ``,
})
export class EmptyConnectionsComponent {
  openNew = output<void>();
}
