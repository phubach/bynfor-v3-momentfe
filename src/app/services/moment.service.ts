import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class MomentService {
  private readonly base = environment.API_ENDPOINT;

  constructor(private http: HttpClient) {}

  getWallMoments(pageSize = 20, pageNumber = 1) {
    const params: any = { size: pageSize, page: pageNumber, myPost: false, fromTopMoment: false, forAdmin: false, hideByAdmin: false };
    return this.http.get<any>(`${this.base}/moments-wall`, { params });
  }

  getWallMoment(id: string) {
    return this.http.get<any>(`${this.base}/moment/${id}`);
  }

  express(momentId: string, operation: 'ADD' | 'REMOVE', expression = 'LIKE', content = '👍') {
    return this.http.get<any>(`${this.base}/moment-expression/${momentId}`, {
      params: <any>{ operation, expression, content },
    });
  }

  addComment(momentId: string, comment: string) {
    return this.http.post<any>(`${this.base}/moment-comment/${momentId}`, { comment, tags: [] });
  }
  getNewVideos(page = 1, pageSize = 18, categoryId?: string, keyword?: string) {
    let url = `${this.base}/new-videos?page=${page}&size=${pageSize}&isFollowing=false`;
    if (categoryId) url += `&categoryId=${categoryId}`;
    return this.http.post<any>(url, { keyword: keyword || '' });
  }

  getVideos(page = 1, pageSize = 6, isFollowing = false) {
    const url =
      `${this.base}/new-videos?page=${page}&size=${pageSize}` +
      `&viewed=false&isFollowing=${isFollowing}&keyword=`;
    return this.http.get<any>(url);
  }

  getVideoCategories() {
    return this.http.get<any>(`${this.base}/video-category`);
  }

  getVideo(id: string) {
    return this.http.get<any>(`${this.base}/video/${id}`);
  }

  addVideoHistory(momentId: string) {
    return this.http.post<any>(`${this.base}/video-history?momentId=${momentId}`, {});
  }
}
