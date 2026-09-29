import { NgModule, APP_INITIALIZER, LOCALE_ID } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { Title } from '@angular/platform-browser';
import { CookieService } from 'ngx-cookie-service';
import {
  I18NextModule,
  I18NEXT_SERVICE,
  I18NextTitle,
  provideI18Next,
  defaultInterpolationFormat,
  ITranslationService,
} from 'angular-i18next';
import XHR from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';
import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { LoginComponent } from './pages/login/login.component';
import { SocialComponent } from './pages/social/social.component';
import { SocialMomentComponent } from './pages/social-moment/social-moment.component';
import { ShortsStripComponent } from './pages/social-moment/shorts-strip/shorts-strip.component';
import { MakePostComponent } from './pages/social-moment/make-post/make-post.component';
import { SocialVideoComponent } from './pages/social-video/social-video.component';
import { CategoryBarComponent } from './pages/social-video/components/category-bar/category-bar.component';
import { VideoTabsComponent } from './pages/social-video/components/video-tabs/video-tabs.component';
import { ReelPlayerComponent } from './pages/social-video/components/reel-player/reel-player.component';
import { ReelInfoComponent } from './pages/social-video/components/reel-info/reel-info.component';
import { ActionRailComponent } from './pages/social-video/components/action-rail/action-rail.component';
import { CommentSheetComponent } from './pages/social-video/components/comment-sheet/comment-sheet.component';
import { FriendPaneComponent } from './pages/social-video/components/friend-pane/friend-pane.component';
import { ReportDialogComponent } from './pages/social-video/components/report-dialog/report-dialog.component';
import { ShareSheetComponent } from './pages/social-video/components/share-sheet/share-sheet.component';
import { LikeListComponent } from './pages/social-video/components/like-list/like-list.component';
import { PeopleSuggestModalComponent } from './pages/social-video/components/people-suggest-modal/people-suggest-modal.component';
import { CreatorProfileComponent } from './pages/social-video/components/creator-profile/creator-profile.component';
import { VideoGridComponent } from './pages/social-video/components/video-grid/video-grid.component';
import { TokenInterceptor } from './core/auth/token.interceptor';
import { SocialCategoryVideoComponent } from './pages/social-category-video/social-category-video.component';
import { SocialProfileComponent } from './pages/social-profile/social-profile.component';
import { VideoDetailPopupComponent } from './pages/social-category-video/video-detail-popup/video-detail-popup.component';

export function appInit(i18next: ITranslationService) {
  return () =>
    i18next
      .use(XHR)
      .use(LanguageDetector)
      .init({
        supportedLngs: ['en', 'zh', 'zh2', 'es', 'ru', 'vn', 'ja', 'hi', 'ko', 'ar'],
        lng: 'en',
        fallbackLng: 'en',
        debug: false,
        returnEmptyString: false,
        saveMissing: false,
        ns: ['translation'],
        interpolation: {
          format: defaultInterpolationFormat,
        },
        backend: {
          loadPath: 'locale/{{lng}}.{{ns}}.json',
          allowMultiLoading: false,
        },
        detection: {
          order: ['querystring', 'cookie'],
          lookupCookie: 'lang',
          lookupQuerystring: 'lng',
          caches: ['localStorage', 'cookie'],
          cookieMinutes: 10080,
        },
      });
}

export function localeIdFactory(i18next: ITranslationService) {
  return i18next.language;
}

export const I18N_PROVIDERS = [
  {
    provide: APP_INITIALIZER,
    useFactory: appInit,
    deps: [I18NEXT_SERVICE],
    multi: true,
  },
  {
    provide: Title,
    useClass: I18NextTitle,
  },
  {
    provide: LOCALE_ID,
    deps: [I18NEXT_SERVICE],
    useFactory: localeIdFactory,
  },
];

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    SocialComponent,
    SocialMomentComponent,
    SocialVideoComponent,
    CategoryBarComponent,
    VideoTabsComponent,
    ReelPlayerComponent,
    ReelInfoComponent,
    ActionRailComponent,
    CommentSheetComponent,
    FriendPaneComponent,
    ReportDialogComponent,
    ShareSheetComponent,
    LikeListComponent,
    PeopleSuggestModalComponent,
    CreatorProfileComponent,
    VideoGridComponent,
    ShortsStripComponent,
    MakePostComponent,
    SocialVideoComponent,
    SocialCategoryVideoComponent,
    VideoDetailPopupComponent,
    SocialProfileComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    I18NextModule.forRoot(),
    AppRoutingModule,
  ],
  providers: [
    ...I18N_PROVIDERS,
    provideI18Next(),
    CookieService,
    { provide: HTTP_INTERCEPTORS, useClass: TokenInterceptor, multi: true },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
