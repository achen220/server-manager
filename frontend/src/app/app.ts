import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { HeaderComponent } from './components/header.component';

@Component({
  imports: [RouterModule, HeaderComponent],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
