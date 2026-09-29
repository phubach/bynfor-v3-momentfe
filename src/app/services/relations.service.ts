import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class RelationsService {
  private readonly customerBase = environment.API_ENDPOINT_CUSTOMER;
  private readonly customers = '/customers';

  constructor(private http: HttpClient) {}

  followSeller(sellerId: number | string) {
    return this.http.post<any>(`${this.customerBase}${this.customers}/${sellerId}/followers`, {});
  }

  unfollowSeller(sellerId: number | string) {
    return this.http.delete<any>(`${this.customerBase}${this.customers}/${sellerId}/followers`);
  }

  addToFriends(sellerId: number | string) {
    return this.http.post<any>(`${this.customerBase}${this.customers}/${sellerId}/friends`, {});
  }

  cancelFriendRequest(sellerId: number | string) {
    return this.http.delete<any>(`${this.customerBase}${this.customers}/${sellerId}/cancel-friend-request`);
  }

  acceptFriendRequest(sellerId: number | string) {
    return this.http.post<any>(`${this.customerBase}${this.customers}/${sellerId}/accept`, {});
  }

  removeFromFriends(sellerId: number | string, customerId: number | string) {
    return this.http.delete<any>(`${this.customerBase}${this.customers}/${sellerId}/friends?customerId=${customerId}`);
  }

  rejectFriendRequest(sellerId: number | string) {
    return this.http.delete<any>(`${this.customerBase}${this.customers}/${sellerId}/reject`);
  }

  getCustomerRelation(id: number | string) {
    return this.http.get<any>(`${this.customerBase}${this.customers}/${id}/relation`);
  }

  getFriendsWithFollowing() {
    return this.http.get<any>(`${this.customerBase}${this.customers}/friends-new?page=1&size=999999`);
  }
}
