import { Component } from '@angular/core';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

@Component({
  selector: 'app-loader',
  standalone: true,
  imports: [ProgressSpinnerModule],
  template: `
    <div class="loader-wrap">
      <p-progressspinner
        strokeWidth="3"
        [style]="{ width: '3rem', height: '3rem' }"
        animationDuration="0.8s"
      />
    </div>
  `,
  styles: `
    .loader-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 5rem 2rem;
    }
  `,
})
export class LoadingComponent {}
