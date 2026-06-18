import { Component, inject, input, OnInit } from '@angular/core';
import { ServerService } from './server.service';

@Component({
  selector: 'app-server-manager',
  standalone: true,
  imports: [],
  template: `<p>hello here</p>`,
  styles: ``,
})
export class ServerManagerComponent implements OnInit {
  private serverService = inject(ServerService);
  id = input<string>();

  ngOnInit(): void {
    console.log('server init', this.id());
    this.serverService.initSSH(this.id() as string);
  }
}
