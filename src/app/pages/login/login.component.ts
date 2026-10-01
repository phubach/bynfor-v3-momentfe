import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { I18NEXT_SERVICE, ITranslationService } from 'angular-i18next';
import { AuthService } from '../../core/auth/auth.service';
import { UserService } from '../../services/user.service';
import { environment } from '../../../environments/environment';
@Component({
  selector: 'app-login',
  standalone: false,
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent implements OnInit, OnDestroy {
  form = this.fb.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });
  checking = true;
  loading = false;
  showPassword = false;
  error = '';
  currentLang = 'en';
  langs = ['en', 'vn', 'zh', 'zh2', 'es', 'ru', 'ja', 'hi', 'ko', 'ar'];

  private readonly onSsoMessage = (event: MessageEvent) => {
    if (event.data?.type !== 'bynfor-moment-token') return;
    if (this.auth.adoptToken(event.data.token)) {
      this.auth.validateToken().subscribe((ok) => {
        if (ok) {
          // Nạp sẵn profile + friends ngay sau đăng nhập (SSO).
          this.users.warmSession();
          this.router.navigateByUrl('/social/moment');
        } else {
          this.auth.logout(false);
          this.error = this.i18n.t('moment.login.tokenInvalid');
        }
      });
    }
  };

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private users: UserService,
    private router: Router,
    private route: ActivatedRoute,
    @Inject(I18NEXT_SERVICE) private i18n: ITranslationService,
  ) {}

  ngOnInit(): void {
    this.currentLang = this.i18n.language || 'en';
    window.addEventListener('message', this.onSsoMessage);
    const hostWindow = window.opener || (window.parent !== window ? window.parent : null);
    if (hostWindow) {
      hostWindow.postMessage({ type: 'bynfor-moment-token-request' }, '*');
    }
    const hadUrlToken = this.auth.consumeTokenFromUrl(window.location.search || '');
    if (hadUrlToken) {
      const clean = window.location.pathname;
      window.history.replaceState({}, '', clean);
    }
    if (!this.auth.hasToken()) {
      this.checking = false;
      return;
    }
    this.auth.validateToken().subscribe((ok) => {
      this.checking = false;
      if (ok) {
        // Token URL hoặc token cũ còn hiệu lực: nạp sẵn session rồi mới vào app.
        this.users.warmSession();
        const ret = this.route.snapshot.queryParamMap.get('returnUrl') || '/social/moment';
        this.router.navigateByUrl(ret);
      } else {
        this.auth.logout(false);
      }
    });
  }

  ngOnDestroy(): void {
    window.removeEventListener('message', this.onSsoMessage);
  }

  changeLang(lang: string): void {
    this.i18n.changeLanguage(lang).then(() => {
      this.currentLang = lang;
      document.cookie = `lang=${lang};path=/;max-age=604800`;
    });
  }

  submit(): void {
    if (this.form.invalid || this.loading) return;
    this.loading = true;
    this.error = '';
    const { username, password } = this.form.value;
    this.auth.login(username!, password!).subscribe({
      next: () => {
        this.loading = false;
        // Nạp sẵn profile + friends ngay sau đăng nhập thường.
        this.users.warmSession();
        const ret = this.route.snapshot.queryParamMap.get('returnUrl') || '/social/moment';
        this.router.navigateByUrl(ret);
      },
      error: (e) => {
        this.loading = false;
        this.error =
          e?.error?.error_description ||
          e?.error?.message ||
          this.i18n.t('moment.login.signinFailed');
      },
    });
  }

  backToMain(): void {
    window.location.href = environment.MAIN_SITE_URL;
  }
}
