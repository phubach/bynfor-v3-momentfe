import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';
import { CookieService } from 'ngx-cookie-service';
import { Observable, catchError, map, of } from 'rxjs';
import * as CryptoJS from 'crypto-js';
import { environment } from '../../../environments/environment';
@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(
    private http: HttpClient,
    private cookies: CookieService,
    private router: Router,
  ) {}
  getToken(): string {
    const fromCookie = this.cookies.get('access_token');
    if (fromCookie.length > 2) return fromCookie;
    const fromLs = [
      environment.LS_TOKEN_KEY,
      'access_token',
      'accessToken',
      'bynforAccessToken',
    ]
      .map(key => localStorage.getItem(key) || '')
      .find(token => token.length > 2) || '';
    if (fromLs.length > 2) return fromLs;
    return '';
  }

  hasToken(): boolean {
    return this.getToken().length > 2;
  }

  adoptToken(token: string): boolean {
    token = (token || '').trim();
    if (token.length <= 2) return false;
    this.saveSession({ access_token: token } as any, 0);
    return true;
  }

  consumeTokenFromUrl(search: string): boolean {
    const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
    for (const key of environment.TOKEN_QUERY_KEYS) {
      const t = (params.get(key) || '').trim();
      if (t.length > 2) {
        this.saveSession({ access_token: t } as any, 0);
        return true;
      }
    }
    return false;
  }

  validateToken(): Observable<boolean> {
    const token = this.getToken();
    if (!token) return of(false);
    return this.http.get(`${environment.AUTH_API_ENDPOINT}/user`).pipe(
      map(() => true),
      catchError(() => of(false)),
    );
  }

  login(username: string, password: string): Observable<any> {
    const basic = `Basic ${btoa(`${environment.jwt_username}:${environment.jwt_password}`)}`;
    const body = new HttpParams()
      .set('username', username)
      .set('password', CryptoJS.SHA256(password).toString())
      .set('grant_type', 'password')
      .set('scope', 'webclient customerfrontend');
    return this.http
      .post(`${environment.AUTH_API_ENDPOINT}/oauth/token`, body.toString(), {
        headers: { Authorization: basic, 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      .pipe(
        map((resp: any) => {
          this.saveSession(resp, resp?.expires_in ?? 0);
          localStorage.setItem('lastLoggedInUsername', username);
          return resp;
        }),
      );
  }

  private saveSession(resp: any, expiresInSec: number): void {
    if (!resp?.access_token) return;
    let expiry: Date | undefined;
    if (expiresInSec > 0) expiry = new Date(Date.now() + expiresInSec * 1000);
    this.cookies.set('access_token', resp.access_token, expiry as any, '/');
    if (resp.refresh_token) this.cookies.set('refresh_token', resp.refresh_token, expiry as any, '/');
    localStorage.setItem(environment.LS_TOKEN_KEY, resp.access_token);
  }

  logout(returnToLogin = true): void {
    this.cookies.delete('access_token', '/');
    this.cookies.delete('refresh_token', '/');
    this.cookies.delete('expires_in', '/');
    this.cookies.set('access_token', '', undefined, '/');
    localStorage.removeItem(environment.LS_TOKEN_KEY);
    localStorage.removeItem('access_token');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('bynforAccessToken');
    if (returnToLogin) this.router.navigate(['/login']);
  }
}
