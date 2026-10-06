import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class MomentService {
  private readonly base = environment.API_ENDPOINT;
  private readonly shareTargetRequests = new Map<string, Observable<any>>();

  constructor(private http: HttpClient) {}

  getWallMoments(pageSize = 20, pageNumber = 1, myPost = false, friendPost = false, userId?: any, fromTopMoment = false, hidden = false, storeId?: any) {
    const params: any = { size: pageSize, page: pageNumber, myPost, fromTopMoment, forAdmin: false, hideByAdmin: !!hidden };
    if (userId != null) params.userId = userId;
    if (friendPost) params.friendAndFollower = true;
    if (storeId != null && String(storeId) !== '') params.store = storeId;
    return this.http.get<any>(`${this.base}/moments-wall`, { params });
  }

  /** Nhóm của user để đăng với IS_GROUP (giống GroupService.getList bên customerfe, không đổi BE). */
  getGroups(userId: string | number) {
    return this.http.get<any>(`${environment.AUTH_API_ENDPOINT}/group/all/${userId}`);
  }

  /** Danh sách chat gốc (RelationsService.getUserChatMenu bên customerfe). */
  getUserChatMenu(userId: string | number, userName = '') {
    const key = `chat-menu:${userId}`;
    return this.getCachedShareTargets(key, () => this.http.get<any>(`${environment.API_ENDPOINT_SOCKET_IO}/user/user-chat-menu/${userId}`, {
      params: { userName } as any,
    }));
  }

  /** Danh sách chat Groups gốc (getGroupsNameLiveChatUsingSocket bên customerfe). */
  getGroupsOfUser(userId: string | number) {
    const key = `chat-groups:${userId}`;
    return this.getCachedShareTargets(key, () => this.http.get<any>(`${environment.API_ENDPOINT_SOCKET_IO}/group/get-groups-of-user/${userId}`));
  }

  /** Nạp recipients ngay sau login; component Moment dùng lại cùng cache khi mở Share. */
  preloadShareTargets(userId: string | number, userName = ''): void {
    if (userId == null || String(userId) === '') return;
    this.getUserChatMenu(userId, userName).subscribe({ error: () => {} });
    this.getGroupsOfUser(userId).subscribe({ error: () => {} });
  }

  resetShareTargetCache(): void {
    this.shareTargetRequests.clear();
  }

  private getCachedShareTargets(key: string, request: () => Observable<any>): Observable<any> {
    const cached = this.shareTargetRequests.get(key);
    if (cached) return cached;
    const source = request().pipe(shareReplay({ bufferSize: 1, refCount: false }));
    this.shareTargetRequests.set(key, source);
    return source;
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

  createMoment(body: { content: string; attachments: any[]; accessedBy?: string; groupId?: string; tags?: string[]; tagUsers?: any[]; taggers?: any[]; taggerIds?: string[]; activity?: string; subActivity?: string; gift?: { shareMoney: number; quantityWallet: number; bynforTitle: string; nameDisplayGift: string; isEarnedSkillRewards: boolean; isMonetaryPoints: boolean; isEarnings: boolean } }) {
    const payload: any = {
      accessedBy: body.accessedBy || 'IS_PUBLIC',
      ...(body.groupId ? { groupId: body.groupId } : {}),
      tagUsers: body.tagUsers || [],
      taggers: body.taggers || [],
      taggerIds: body.taggerIds || [],
      tags: body.tags || [],
      activity: body.activity || 'No Feeling/Activity',
      subActivity: body.subActivity || '',
      attachments: body.attachments || [],
      content: body.content || '',
      redPacketShare: !!body.gift,
      ...(body.gift || {}),
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

  expressComment(momentId: string, commentId: string, expression: any) {
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

  getReportedMoments(page = 1, size = 20) {
    return this.http.post<any>(this.base + '/moments-reported-user', { order: { column: 'reportReasons.reportedAt', dir: 'desc' }, search: { value: '', regex: false }, start: (page - 1) * size, length: size });
  }
  revokeReport(momentId: string) { return this.http.put<any>(this.base + '/moment-report-revoke/' + momentId, {}); }

  reportMoment(momentId: string, reason: string, evidence: { imageUrls?: string[]; videoUrls?: string[]; fileUrls?: string[]; note?: string } = {}) {
    const body: any = { reason };
    if (evidence.imageUrls?.length) body.imageUrls = evidence.imageUrls;
    if (evidence.videoUrls?.length) body.videoUrls = evidence.videoUrls;
    if (evidence.fileUrls?.length) body.fileUrls = evidence.fileUrls;
    if (evidence.note?.trim()) body.note = evidence.note.trim();
    return this.http.post<any>(`${this.base}/moment-report/${momentId}`, body);
  }

  /** Endpoint upload documents đang được customerfe dùng trước khi gửi report. */
  uploadDocuments(formData: FormData) {
    return this.http.post<any>(`${this.base}/products/documents`, formData);
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

  getVideoFeedbacks(userId: string, type: 'MAIN' | 'TARGET') {
    return this.http.get<any>(`${environment.API_ENDPOINT_SOCKET_IO}/feedback`, { params: { userId, type } });
  }

  createVideoFeedback(body: any) {
    return this.http.post<any>(`${environment.API_ENDPOINT_SOCKET_IO}/feedback`, body);
  }

  notifyVideoFeedback(userId: string, name: string) {
    return this.http.post<any>(`${environment.API_ENDPOINT_CUSTOMER}/pushNotification/list`, {
      pushNotificationRequest: [{ userId, text: `${name} left feedback for your video`, detailType: 'MAIN', messageType: 'FEEDBACK_VIDEO', messageState: 'UNREAD' }],
    });
  }

  /** Danh sách feeling/activity cho popup Edit (giống getListOfActivities của customerfe). */
  getListOfActivities() {
    return this.http.get<any>(`${this.base}/activity`);
  }

  getActiveMomentReward() {
    return this.http.get<any>(`${this.base}/moment-reward-fund/get-active`);
  }

  claimMomentReward() {
    return this.http.post<any>(`${this.base}/moment-reward-fund/grab`, {});
  }

  claimCreditReward() {
    return this.http.post<any>(`${this.base}/moment-credit-reward/grab`, {});
  }

  getClaimedMomentRewards(page = 1, size = 10) {
    return this.http.get<any>(`${environment.API_ENDPOINT_PAYMENT}/moment-reward/claimed`, { params: { partyId: 1, page, size } });
  }

  grabMonetaryGift(momentId: string, userId: string) {
    return this.http.post<any>(`${this.base}/moment/red-packet/grab/${momentId}`, { userId: Number(userId), amount: 0 });
  }

  /** Danh sách người đã nhận quà của 1 moment (giống getWalletActionByMomentPage gốc). */
  getWalletActionByMomentPage(momentId: string, page = 1, size = 5) {
    return this.http.get<any>(`${environment.API_ENDPOINT_PAYMENT}/payment/wallet-point-action/user-grabbed-page`, {
      params: { momentId, page: String(page), size: String(size) },
    });
  }

  getVideo(id: string) {
    return this.http.get<any>(`${this.base}/video/${id}`);
  }

  reportVideo(data: { momentId: string; id: string; reported: boolean }) {
    return this.http.post<any>(`${this.base}/report-video`, data);
  }

  getReportedVideo(id: string) {
    return this.http.get<any>(`${environment.API_ENDPOINT_SOCKET_IO}/video/${encodeURIComponent(id)}`);
  }

  saveVideoReport(body: { _id?: string; videoId: string; report: { reportedBy: number | string; message: string; isOthers: boolean } }) {
    return this.http.post<any>(`${environment.API_ENDPOINT_SOCKET_IO}/video/report`, body);
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
