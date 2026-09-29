import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly authBase = environment.AUTH_API_ENDPOINT;
  private readonly user = '/user';
  private me$: Observable<any> | null = null;

  constructor(private http: HttpClient) {}

  getCurrentUser(): Observable<any> {
    if (!this.me$) {
      this.me$ = this.http.get<any>(`${environment.AUTH_API_ENDPOINT}/user`).pipe(
        map((res: any) => res?.data || res),
        catchError(() => of(null)),
        shareReplay(1),
      );
    }
    return this.me$;
  }

  getSelectedUser(userId: string | number) {
    return this.http.get<any>(`${environment.AUTH_API_ENDPOINT}/selected-user/${userId}`);
  }

  getFollowCounts(userId: string | number) {
    return this.http.get<any>(
      `${environment.API_ENDPOINT_CUSTOMER}/customers/count-following-and-follower?userId=${userId}`,
    );
  }

  static profileId(u: any): string {
    if (!u) return '';
    const id = u.id ?? u.userId ?? u.customerId ?? u.customerID;
    return id != null ? String(id) : '';
  }

  getPeople(page: number, size: number) {
    return this.http.get<any>(`${this.authBase}${this.user}/moment-wall?page=${page}&size=${size}`);
  }

  noShowPeople(data: { noShowPeople: boolean }) {
    return this.http.post<any>(`${this.authBase}${this.user}/no-show-people`, data);
  }

  getUserById(id: number | string) {
    return this.http.get<any>(`${this.authBase}${this.user}/${id}`);
  }

  /** BE giữ nguyên: tìm user + relationStatus (modal profile creator). */
  findUserByMobileNo(text: string, page = 1) {
    return this.http.post<any>(`${this.authBase}${this.user}/find-user-by-anything?page=${page}`, { text });
  }
}
