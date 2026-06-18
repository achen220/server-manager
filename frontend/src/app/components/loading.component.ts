import { Component } from '@angular/core';

@Component({
  selector: 'app-loader',
  standalone: true,
  imports: [],
  template: ` <div class="empty-state">
    <i class="pi pi-spin pi-spinner" style="font-size: 2rem"></i>
  </div>`,
  styles: ``,
})
export class LoadingComponent {}
