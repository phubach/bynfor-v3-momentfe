import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map, retry, shareReplay } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface TagUser {
  id: string;
  userName: string;
  fullName: string;
  firstName: string;
  lastName: string;
  profilePictureUrl: string;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly authBase = environment.AUTH_API_ENDPOINT;
  private readonly user = '/user';
  private me$: Observable<any> | null = null;

  constructor(private http: HttpClient) {}

  resetSessionCache(): void {
    this.me$ = null;
    this.tagRelatives$ = null;
  }

  getCurrentUser(): Observable<any> {
    if (!this.me$) {
      this.me$ = this.http.get<any>(`${environment.AUTH_API_ENDPOINT}/user`).pipe(
        map((res: any) => {
          const profile = res?.data || res;
          if ((res?.status != null && Number(res.status) !== 200) || !UserService.profileId(profile)) {
            throw new Error('Invalid current-user response');
          }
          return profile;
        }),
        // A direct refresh can race cookie/local-storage restoration by a few
        // milliseconds. Retry once before exposing the empty-profile fallback.
        retry({ count: 1, delay: 250 }),
        catchError(() => {
          // A failed request must not cache an empty profile for the whole session.
          this.me$ = null;
          return of(null);
        }),
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

  /** Same thumbnail convention as customerfe's UtilsService.getImageThumbnails. */
  static avatarUrl(user: any, original = false): string {
    // auth/user and friends-new expose the ready-to-use thumbnail separately.
    // Prefer it so we do not manufacture a URL for older socket/chat images.
    const raw = original
      ? (user?.profilePictureUrl || user?.profileSmallPictureUrl)
      : (user?.profileSmallPictureUrl || user?.profilePictureUrl);
    if (typeof raw !== 'string') return '';
    const url = raw.trim();
    if (!url || url === 'null' || url === 'undefined') return '';
    return !original && url.includes('_original_') && !url.includes('.gif')
      ? url.replace(/original/g, 'thumbnail')
      : url;
  }

  /** Store của user (để chọn tên hiển thị, giống create-moment của customerfe). */
  getStoreByOwner(userId: string | number) {
    return this.http.get<any>(`${environment.API_ENDPOINT_STORE}/stores/owner/${userId}`);
  }

  findUserSuggestion(text: string, page = 1) {
    return this.http.post<any>(`${environment.AUTH_API_ENDPOINT}/user/suggestion?page=${page}`, { text });
  }

  private tagRelatives$: Observable<TagUser[]> | null = null;

  static normalizeTagUsers(data: any): TagUser[] {
    const list = Array.isArray(data) ? data : data?.list || [];
    const norm = (u: any): TagUser => ({
      id: String(u?.id ?? u?.userId ?? u?.customerId ?? ''),
      userName: u?.userName || '',
      fullName: [u?.firstName, u?.lastName].filter(Boolean).join(' ') || u?.fullName || u?.name || '',
      firstName: u?.firstName || '',
      lastName: u?.lastName || '',
      profilePictureUrl: u?.profilePictureUrl || '',
    });
    return list.map(norm).filter((u) => u.id);
  }

  getTagRelatives(): Observable<TagUser[]> {
    if (!this.tagRelatives$) {
      const base = environment.API_ENDPOINT_CUSTOMER;
      this.tagRelatives$ = forkJoin({
        friends: this.http.get<any>(`${base}/customers/friends?size=999999&page=1&keyword=`).pipe(catchError(() => of(null))),
        followed: this.http.get<any>(`${base}/customers/followees?size=999999&page=1&keyword=`).pipe(catchError(() => of(null))),
      }).pipe(
        map((res: any) => {
          const all = [
            ...UserService.normalizeTagUsers(res.friends?.data),
            ...UserService.normalizeTagUsers(res.followed?.data),
          ];
          const seen = new Set<string>();
          return all.filter((u) => (seen.has(u.id) ? false : (seen.add(u.id), true)));
        }),
        catchError(() => of([])),
        shareReplay(1),
      );
    }
    return this.tagRelatives$;
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

  findUserByMobileNo(text: string, page = 1) {
    return this.http.post<any>(`${this.authBase}${this.user}/find-user-by-anything?page=${page}`, { text });
  }
}
