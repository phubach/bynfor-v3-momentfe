import { Injectable } from '@angular/core';
import { HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { AuthService } from './auth.service';
@Injectable()
export class TokenInterceptor implements HttpInterceptor {
  constructor(private auth: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler) {
    if (
      req.url.includes('oauth/token') ||
      req.url.includes('/login/google') ||
      req.url.includes('/login/facebook') ||
      req.url.startsWith('https://api.unsplash.com/')
    ) {
      return next.handle(req);
    }
    const token = this.auth.getToken();
    if (token) {
      req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
    }
    return next.handle(req);
  }
}
