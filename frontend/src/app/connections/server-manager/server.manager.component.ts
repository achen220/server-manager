import { Component, inject, input, OnInit } from '@angular/core';
import { forkJoin, switchMap } from 'rxjs';
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
    const serverManager$ = this.serverService.initSSH(this.id() as string).pipe(
      switchMap((x) =>
        forkJoin({
          ssUsers: this.serverService.activeSSHUsers(),
        }),
      ),
    );

    serverManager$.subscribe((c) => console.log({ c }));
  }
}
