import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class MomentService {
  private readonly base = environment.API_ENDPOINT;

  constructor(private http: HttpClient) {}

  getWallMoments(pageSize = 20, pageNumber = 1, myPost = false, friendPost = false, userId?: any) {
    const params: any = { size: pageSize, page: pageNumber, myPost, fromTopMoment: false, forAdmin: false, hideByAdmin: false };
    if (userId != null) params.userId = userId;
    if (friendPost) params.friendAndFollower = true;
    return this.http.get<any>(`${this.base}/moments-wall`, { params });
  }

  getWallMoment(id: string) {
    return this.http.get<any>(`${this.base}/moment/${id}`);
  }

  updateMoment(moment: any) {
    return this.http.put<any>(`${this.base}/moment`, moment);
  }

  deleteMoment(id: string) {
    return this.http.delete<any>(`${this.base}/moment/${id}`);
  }

  createMoment(body: { content: string; attachments: any[]; accessedBy?: string; tags?: string[] }) {
    const payload: any = {
      accessedBy: body.accessedBy || 'IS_PUBLIC',
      tagUsers: [],
      tags: body.tags || [],
      activity: 'No Feeling/Activity',
      subActivity: '',
      attachments: body.attachments || [],
      content: body.content || '',
      redPacketShare: false,
      isDisplayPublic: false,
      momentCampaign: null,
      isSocialBusinessAccountMoments: false,
    };
    return this.http.post<any>(`${this.base}/moment`, payload);
  }

  uploadImages(formData: FormData) {
    return this.http.post<any>(`${this.base}/products/resized/images/list`, formData);
  }

  uploadVideos(formData: FormData) {
    return this.http.post<any>(`${this.base}/chat-video/upload/list?isMoment=true`, formData);
  }

  express(momentId: string, operation: 'ADD' | 'REMOVE', expression = 'LIKE', content = '👍') {
    return this.http.get<any>(`${this.base}/moment-expression/${momentId}`, {
      params: <any>{ operation, expression, content },
    });
  }

  endorse(momentId: string, operation: 'ADD' | 'REMOVE') {
    return this.http.get<any>(`${this.base}/endorse-moment/${momentId}`, {
      params: <any>{ operation },
    });
  }

  expressComment(momentId: string, commentId: string, expression: any = '👍') {
    return this.http.post<any>(`${this.base}/moment-comment/expression/${momentId}/${commentId}`, expression);
  }

  addComment(momentId: string, comment: string, parentId?: string | null, tags: any[] = []) {
    return this.http.post<any>(`${this.base}/moment-comment/${momentId}`, {
      comment,
      tags,
      parent_id: parentId || null,
    });
  }

  editComment(momentId: string, data: { comment_id: string; comment: string; commentedAt: string }) {
    return this.http.post<any>(`${this.base}/moment-comment/edit/${momentId}`, data);
  }

  deleteComment(momentId: string, data: { comment_id: string; comment: string; commentedAt: string }) {
    return this.http.post<any>(`${this.base}/moment-comment/delete/${momentId}`, data);
  }

  reportMoment(momentId: string, reason: string) {
    return this.http.post<any>(`${this.base}/moment-report/${momentId}`, { reason });
  }

  getCustomerLikeOrDisLike(momentId: string, page = 1, pageSize = 10, expression = 'LIKE', expressedContent = '') {
    const params = ['page=' + page, '&size=' + pageSize, '&expression=' + expression, expressedContent ? '&expressedContent=' + expressedContent : ''].join('');
    return this.http.get<any>(`${this.base}/moment-expression/customerLikeOrDisLike/${momentId}?${params}`);
  }

  getCustomerCommentLikeOrDisLike(momentId: string, commentId: string, page = 1, pageSize = 10, expressedContent = '') {
    const params = ['page=' + page, '&size=' + pageSize, '&expressedContent=' + (expressedContent || '')].join('');
    return this.http.get<any>(`${this.base}/moment-comment/customerLikeOrDisLike/${momentId}/${commentId}?${params}`);
  }

  searchHashTag(keyword: string) {
    return this.http.post<any>(`${this.base}/hash-tag`, { keyword });
  }

  getNewVideos(page = 1, pageSize = 18, categoryId?: string, keyword?: string) {
    let url = `${this.base}/new-videos?page=${page}&size=${pageSize}&isFollowing=false`;
    if (categoryId) url += `&categoryId=${categoryId}`;
    return this.http.post<any>(url, { keyword: keyword || '' });
  }

  getVideos(page = 1, pageSize = 6, isFollowing = false, categoryId?: string | null, keyword = '', userId?: string | null, viewed = false) {
    let url =
      `${this.base}/new-videos?page=${page}&size=${pageSize}` +
      `&viewed=${!!viewed}&isFollowing=${isFollowing}&keyword=${encodeURIComponent(keyword || '')}`;
    if (categoryId) url += `&categoryId=${categoryId}`;
    if (userId) url += `&customerId=${userId}`;
    return this.http.get<any>(url);
  }

  getVideoCategories() {
    return this.http.get<any>(`${this.base}/video-category`);
  }

  /** Danh sách feeling/activity cho popup Edit (giống getListOfActivities của customerfe). */
  getListOfActivities() {
    return this.http.get<any>(`${this.base}/activity`);
  }

  getVideo(id: string) {
    return this.http.get<any>(`${this.base}/video/${id}`);
  }

  reportVideo(data: { momentId: string; id: string; reported: boolean }) {
    return this.http.post<any>(`${this.base}/report-video`, data);
  }

  addVideoHistory(momentId: string) {
    return this.http.post<any>(`${this.base}/video-history?momentId=${momentId}`, {});
  }

  getVideoHistories(page = 1, pageSize = 20) {
    return this.http.get<any>(`${this.base}/video-history?page=${page}&size=${pageSize}`);
  }

  getCountMoments(id: string | number) {
    return this.http.get<any>(`${this.base}/count-moments/${id}`);
  }

  getMediaFiles(page = 1, pageSize = 18, userId?: string | number, mediaType?: string) {
    let url = `${this.base}/media-files?page=${page}&size=${pageSize}&isFollowing=false`;
    if (userId) url += `&customerId=${userId}`;
    if (mediaType && mediaType !== 'TAG') url += `&type=${mediaType}`;
    return this.http.post<any>(url, { keyword: mediaType === 'TAG' ? '#' : '' });
  }
}
