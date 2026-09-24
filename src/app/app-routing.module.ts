import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { SocialComponent } from './pages/social/social.component';
import { SocialMomentComponent } from './pages/social-moment/social-moment.component';
import { SocialVideoComponent } from './pages/social-video/social-video.component';
import { authGuard } from './core/auth/auth.guard';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: 'social',
    component: SocialComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'moment' },
      { path: 'moment', component: SocialMomentComponent },
      { path: 'video', component: SocialVideoComponent },
    ],
  },
  { path: 'moment', redirectTo: 'social/moment' },
  { path: '', pathMatch: 'full', redirectTo: 'social' },
  { path: '**', redirectTo: 'social' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
