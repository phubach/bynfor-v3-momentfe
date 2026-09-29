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

  createMoment(body: { content: string; attachments: any[]; accessedBy?: string }) {
    const payload: any = {
      accessedBy: body.accessedBy || 'IS_PUBLIC',
      tagUsers: [],
      tags: [],
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

  /** Upload ảnh (giống CreateMomentComponent): trả về [{origin, small}]. */
  uploadImages(formData: FormData) {
    return this.http.post<any>(`${this.base}/products/resized/images/list`, formData);
  }

  /** Upload video (giống CreateMomentComponent): trả về [url]. */
  uploadVideos(formData: FormData) {
    return this.http.post<any>(`${this.base}/chat-video/upload/list?isMoment=true`, formData);
  }

  express(momentId: string, operation: 'ADD' | 'REMOVE', expression = 'LIKE', content = '👍') {
    return this.http.get<any>(`${this.base}/moment-expression/${momentId}`, {
      params: <any>{ operation, expression, content },
    });
  }

  /** BE giữ nguyên (customerfe: endorse(m, operation) -> GET /endorse-moment/:id). */
  endorse(momentId: string, operation: 'ADD' | 'REMOVE') {
    return this.http.get<any>(`${this.base}/endorse-moment/${momentId}`, {
      params: <any>{ operation },
    });
  }

  /** BE giữ nguyên: POST /moment-comment/expression/:momentId/:commentId */
  expressComment(momentId: string, commentId: string, expression: any = '👍') {
    return this.http.post<any>(`${this.base}/moment-comment/expression/${momentId}/${commentId}`, expression);
  }

  addComment(momentId: string, comment: string, parentId?: string | null) {
    return this.http.post<any>(`${this.base}/moment-comment/${momentId}`, {
      comment,
      tags: [],
      parent_id: parentId || null,
    });
  }

  editComment(momentId: string, data: { comment_id: string; comment: string; commentedAt: string }) {
    return this.http.post<any>(`${this.base}/moment-comment/edit/${momentId}`, data);
  }

  deleteComment(momentId: string, data: { comment_id: string; comment: string; commentedAt: string }) {
    return this.http.post<any>(`${this.base}/moment-comment/delete/${momentId}`, data);
  }

  /** BE giữ nguyên: POST /moment-report/:id */
  reportMoment(momentId: string, reason: string) {
    return this.http.post<any>(`${this.base}/moment-report/${momentId}`, { reason });
  }

  /** BE giữ nguyên: GET customerLikeOrDisLike (popup xem ai đã like). */
  getCustomerLikeOrDisLike(momentId: string, page = 1, pageSize = 10, expression = 'LIKE', expressedContent = '') {
    const params = ['page=' + page, '&size=' + pageSize, '&expression=' + expression, expressedContent ? '&expressedContent=' + expressedContent : ''].join('');
    return this.http.get<any>(`${this.base}/moment-expression/customerLikeOrDisLike/${momentId}?${params}`);
  }

  /** BE giữ nguyên: ai đã like 1 comment (tab Comment trong modal likes). */
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

  /** BE giữ nguyên signature customerfe: getVideos(page, size, isFollowing, categoryId, keyword, userId, viewed). */
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

  getVideo(id: string) {
    return this.http.get<any>(`${this.base}/video/${id}`);
  }

  /** BE giữ nguyên: POST /report-video { momentId, id, reported } */
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
