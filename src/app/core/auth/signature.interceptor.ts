import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';
import { enc, HmacSHA512 } from 'crypto-js';
import { environment } from '../../../environments/environment';

@Injectable()
export class SignatureInterceptor implements HttpInterceptor {
  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const url = request.url.split('?')[0];
    // Sign Bynfor gateway calls only; leave translations and external APIs untouched.
    if (new URL(url, 'http://localhost').origin !== new URL(environment.AUTH_API_ENDPOINT).origin) {
      return next.handle(request);
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const signature = enc.Base64.stringify(
      HmacSHA512(url + timestamp + environment.appId, environment.secretKey),
    );
    // Match customerfe: pre-encode Base64, then let Angular encode the query params.
    // The backend SignatureFilter decodes the signature again after servlet parsing.
    return next.handle(request.clone({
      setParams: {
        bfsignature: encodeURIComponent(signature),
        bftimestamp: String(timestamp),
      },
    }));
  }
}
