import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatToolbarModule, MatButtonModule, MatIconModule],
  template: `
    <mat-toolbar color="primary" class="topbar">
      <span class="brand">Flow Automation</span>
      <span class="spacer"></span>
      <a mat-button routerLink="/flows" routerLinkActive="active">Flows</a>
      <a mat-button routerLink="/audiences" routerLinkActive="active">Audiences</a>
      <a mat-button routerLink="/templates" routerLinkActive="active">Templates</a>
      <a mat-button routerLink="/campaigns" routerLinkActive="active">Campaigns</a>
    </mat-toolbar>
    <div class="container">
      <router-outlet />
    </div>
  `,
  styles: [`
    .topbar { position: sticky; top: 0; z-index: 100; }
    .brand { font-weight: 600; }
    .spacer { flex: 1 1 auto; }
    .container { padding: 16px; }
    a.active { font-weight: 600; }
  `]
})
export class AppComponent {
  title = 'flow-fe';
}
