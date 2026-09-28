import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

/**
 * Minimal User API — BE giữ nguyên như customerfe (user.service.ts):
 *  GET  {AUTH_API}/user/moment-wall?page=&size=   (gợi ý "People who you may know")
 *  POST {AUTH_API}/user/no-show-people            (không hiện lại modal)
 */
@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly authBase = environment.AUTH_API_ENDPOINT;
  private readonly user = '/user';

  constructor(private http: HttpClient) {}

  getPeople(page: number, size: number) {
    return this.http.get<any>(`${this.authBase}${this.user}/moment-wall?page=${page}&size=${size}`);
  }

  noShowPeople(data: { noShowPeople: boolean }) {
    return this.http.post<any>(`${this.authBase}${this.user}/no-show-people`, data);
  }

  /** BE giữ nguyên: GET {AUTH}/user/:id (modal profile creator). */
  getUserById(id: number | string) {
    return this.http.get<any>(`${this.authBase}${this.user}/${id}`);
  }

  /** BE giữ nguyên: tìm user + relationStatus (modal profile creator). */
  findUserByMobileNo(text: string, page = 1) {
    return this.http.post<any>(`${this.authBase}${this.user}/find-user-by-anything?page=${page}`, { text });
  }
}
