import { Routes } from '@angular/router';
import { FlowsPageComponent } from './pages/flows/flows-page.component';
import { AudiencesPageComponent } from './pages/audiences/audiences-page.component';
import { TemplatesPageComponent } from './pages/templates/templates-page.component';
import { CampaignsPageComponent } from './pages/campaigns/campaigns-page.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'flows' },
  { path: 'flows', component: FlowsPageComponent },
  { path: 'audiences', component: AudiencesPageComponent },
  { path: 'templates', component: TemplatesPageComponent },
  { path: 'campaigns', component: CampaignsPageComponent },
  { path: '**', redirectTo: 'flows' },
];
