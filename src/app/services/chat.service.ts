import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as CryptoJS from 'crypto-js';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly base = environment.API_ENDPOINT_SOCKET_IO;

  constructor(private http: HttpClient) {}

  private encrypt(value: string): string {
    return CryptoJS.AES.encrypt(value, 'livechat').toString();
  }

  saveMsg(data: any) {
    const message = { ...data };
    if (message.message) message.message = this.encrypt(message.message);
    if (message.newMessage) message.newMessage = this.encrypt(message.newMessage);
    return this.http.post<any>(`${this.base}/message?decrypt=true`, message);
  }

  deleteMsg(msgId: string, userId: string | number) {
    return this.http.delete<any>(`${this.base}/message/${msgId}/${userId}`);
  }
}
