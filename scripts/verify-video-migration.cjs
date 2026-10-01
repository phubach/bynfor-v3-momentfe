// Logic regression checks using the actual component source; no API calls or browser session.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const decorator = () => () => {};
const angular = {
  Component: decorator, Injectable: decorator, HostListener: decorator, Input: decorator, Output: decorator,
  EventEmitter: class { emit() {} },
};
function loadSource(relative) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module, exports: module.exports,
    require(id) {
      if (id === '@angular/core') return angular;
      if (id.endsWith('social-video.model')) return loadSource('src/app/pages/social-video/social-video.model.ts');
      if (id.endsWith('user.service')) return loadSource('src/app/services/user.service.ts');
      if (id.includes('environments/environment')) return { environment: { LS_TOKEN_KEY: 'test-token' } };
      return {};
    },
    navigator: { onLine: true }, location: { origin: 'https://moment.example' },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { querySelectorAll: () => [] }, setTimeout, clearTimeout,
  });
  return module.exports;
}
const { SocialVideoComponent } = loadSource('src/app/pages/social-video/social-video.component.ts');
const { CommentSheetComponent } = loadSource('src/app/pages/social-video/components/comment-sheet/comment-sheet.component.ts');
const { SocialComponent } = loadSource('src/app/pages/social/social.component.ts');
const { UserService } = loadSource('src/app/services/user.service.ts');
const { AuthService } = loadSource('src/app/core/auth/auth.service.ts');
const immediate = data => ({ subscribe(observer) { typeof observer === 'function' ? observer(data) : observer.next(data); } });
function component(moment = {}) {
  const c = new SocialVideoComponent(moment, {}, { getCurrentUser: () => immediate({ id: 7 }) }, {}, { snapshot: { queryParams: {} } });
  return c;
}
test('loading another feed page preserves playback and removes duplicate videos', () => {
  const c = component();
  c.videos = [{ id: 'a' }, { id: 'b' }];
  c.selectedIndex = 1;
  c.paused = true;
  let restarted = 0;
  c.afterSelect = () => restarted++;
  c.applyVideos([{ id: 'b' }, { id: 'c' }], true);
  assert.deepEqual(Array.from(c.videos, v => v.id), ['a', 'b', 'c']);
  assert.equal(c.selectedIndex, 1);
  assert.equal(c.paused, true);
  assert.equal(restarted, 0);
});
test('empty feeds retain the tabs and history remains accessible from Friend', () => {
  const html = fs.readFileSync(path.join(root, 'src/app/pages/social-video/social-video.component.html'), 'utf8');
  assert.match(html, /\*ngIf="tab !== 'FRIEND' \|\| showGrid"/);
  assert.match(html, /\[light\]="true"/);
});
test('category changes reset the viewed fallback', () => {
  const c = component();
  c.viewed = true;
  c.showGrid = true;
  c.getVideos = () => assert.equal(c.viewed, false);
  c.selectCategory('nature');
  assert.equal(c.showGrid, false);
});
test('stale fallback failures cannot overwrite a newer feed', () => {
  const requests = [];
  const c = component({ getVideos: () => ({ subscribe: observer => requests.push(observer) }) });
  c.afterSelect = () => {};
  c.getVideos();
  requests[0].next({ data: [{ id: 'old' }] });
  c.categoryId = 'new';
  c.getVideos();
  requests[1].error(new Error('old request failed'));
  assert.equal(c.videos.length, 0);
  assert.equal(c.loadingFirst, true);
});
test('a shared link starts with its requested video instead of a competing default feed', () => {
  const c = component();
  c.route.snapshot.queryParams.videoId = 'shared-video';
  let requested = '';
  c.openVideoById = id => requested = id;
  c.getVideos = () => assert.fail('Default feed must not compete with the shared video');
  c.getVideoCategories = () => {};
  c.getSuggestPeople = () => {};
  c.ngOnInit();
  assert.equal(requested, 'shared-video');
});
test('stale detail responses cannot replace a new category feed', () => {
  let response;
  const c = component({ getVideo: () => ({ subscribe: observer => response = observer }) });
  c.afterSelect = () => assert.fail('Stale detail must not start playback');
  c.openVideoById('old');
  c.requestId++;
  response.next({ data: { id: 'old' } });
  assert.equal(c.videos.length, 0);
});
test('share URLs use the existing route and encode the video identifier', () => {
  const c = component();
  c.videos = [{ id: 'video /&?' }];
  const url = new URL(c.videoLink());
  assert.equal(url.pathname, '/social/video');
  assert.equal(url.searchParams.get('videoId'), 'video /&?');
});
test('arrow navigation ignores text fields and open overlays', () => {
  const c = component();
  let moved = 0;
  c.nextVideo = () => moved++;
  c.onKey({ key: 'ArrowDown', target: { closest: () => ({}) } });
  c.showGrid = true;
  c.onKey({ key: 'ArrowDown', target: { closest: () => null } });
  let prevented = false;
  c.showGrid = false;
  c.onKey({ key: 'ArrowDown', target: { closest: () => null }, preventDefault: () => prevented = true });
  assert.equal(moved, 1);
  assert.equal(prevented, true);
});
test('scrolling history does not navigate the reel or prevent normal scrolling', () => {
  const c = component();
  c.videos = [{ id: 'a' }];
  c.showGrid = true;
  c.onWheel({ deltaY: 100, preventDefault: () => assert.fail('History scroll was blocked') });
});
test('comment ownership works for numeric and string IDs without granting other users access', () => {
  const c = new CommentSheetComponent();
  c.myUserId = '7';
  assert.equal(c.mine({ from: 7 }), true);
  assert.equal(c.mine({ createdByFull: { id: 7 } }), true);
  assert.equal(c.mine({ from: 8 }), false);
  c.myUserId = null;
  assert.equal(c.mine({ from: 7 }), false);
});
test('header uses the authenticated profile, initials, and an avatar failure fallback', () => {
  const c = new SocialComponent({}, { getCurrentUser: () => immediate({ id: 7, firstName: 'Nam', lastName: 'Nhat', profilePictureUrl: '/avatar.png' }) });
  c.ngOnInit();
  assert.equal(c.displayName, 'Nam Nhat');
  assert.equal(c.initials, 'NN');
  assert.equal(c.profileLink, '/social/social-media-profile/7');
  assert.equal(c.avatarUrl, '/avatar.png');
  c.avatarFailed = true;
  assert.equal(c.avatarUrl, '');
});
test('all locales parse and contain translated connection labels', () => {
  for (const file of fs.readdirSync(path.join(root, 'src/locale'))) {
    if (!file.endsWith('.json')) continue;
    const locale = JSON.parse(fs.readFileSync(path.join(root, 'src/locale', file), 'utf8'));
    assert.ok(locale.social.online, file);
    assert.ok(locale.social.offline, file);
  }
});
test('switching accounts clears cached profile and user suggestions', () => {
  const users = new UserService({});
  users.me$ = {};
  users.tagRelatives$ = {};
  let resets = 0;
  const auth = new AuthService({}, { set() {}, delete() {} }, { navigate() {} }, {
    resetSessionCache() { resets++; users.resetSessionCache(); },
  });
  auth.saveSession({ access_token: 'fixture-token' }, 0);
  assert.equal(users.me$, null);
  assert.equal(users.tagRelatives$, null);
  auth.logout();
  assert.equal(resets, 2);
});
test('posting a comment uses the updated moment returned by the original API', () => {
  const c = component({ addComment: () => immediate({ data: { _id: 'm', comments: [{ comment_id: 'c', comment: 'Hello' }] } }) });
  c.videos = [{ id: 'v', momentId: 'm', momentComments: [] }];
  c.commentDraft = 'Hello';
  c.sendComment();
  assert.equal(c.videos[0].momentComments.length, 1);
  assert.equal(c.videos[0].momentComments[0].comment_id, 'c');
  assert.equal(c.commentDraft, '');
  assert.equal(c.sendingComment, false);
});
