import { Component } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-social',
  standalone: false,
  templateUrl: './social.component.html',
  styleUrls: ['./social.component.scss'],
})
export class SocialComponent {
  constructor(private auth: AuthService) {}

  logout(): void {
    this.auth.logout(true);
  }
}
