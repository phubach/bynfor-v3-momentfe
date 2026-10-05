const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const decorator = () => () => {};
function load(relative) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module, exports: module.exports, setTimeout, clearTimeout,
    window: { confirm: () => true },
    require(id) {
      if (id === '@angular/core') return { Component: decorator, Injectable: decorator, Inject: decorator, Input: decorator, Output: decorator, ViewChild: decorator, EventEmitter: class { emit() {} } };
      if (id.endsWith('user.service')) return { UserService: { profileId: u => String(u?.id ?? ''), normalizeTagUsers: users => users } };
      if (id.includes('environments/environment')) return { environment: { API_ENDPOINT: '/inventory', API_ENDPOINT_PAYMENT: '/payment', API_ENDPOINT_SOCKET_IO: '/realtime', API_ENDPOINT_CUSTOMER: '/customer' } };
      if (id === 'rxjs') return require('rxjs');
      return {};
    },
  });
  return module.exports;
}
const { SocialMomentComponent } = load('src/app/pages/social-moment/social-moment.component.ts');
const { MakePostComponent } = load('src/app/pages/social-moment/make-post/make-post.component.ts');
const { MomentService } = load('src/app/services/moment.service.ts');
function feed(service = {}) {
  const c = new SocialMomentComponent(service, {}, {}, {}, {}, {});
  c.meId = '7'; c.me = { id: 7, stateId: 1 };
  return c;
}
test('feed detects persisted reactions and endorsements across numeric/string user IDs', () => {
  const c = feed();
  const post = c.normalize({ expressions: [{ expression: 'LIKE', expressedBy: 7 }, { expression: 'DISLIKE', expressedBy: 8 }], endorsements: [{ userId: 7 }] });
  assert.equal(post.likeCount, 1); assert.equal(post.likedByMe, true); assert.equal(post.isEndorsedByMe, true);
  post.expressions = []; c.normalize(post); assert.equal(post.likeCount, 0); assert.equal(post.likedByMe, false);
});
test('reset feed ignores late responses and preserves permalink without duplicate posts', () => {
  const requests = [];
  const c = feed({ getWallMoments: () => ({ subscribe: observer => { requests.push(observer); return { unsubscribe() {} }; } }) });
  c.loadFeed(true); c.loadFeed(true);
  requests[0].next({ data: [{ _id: 'old' }] }); assert.equal(c.moments.length, 0);
  c.pinned = { _id: 'pin' };
  requests[1].next({ data: [{ _id: 'pin' }, { _id: 'new' }] });
  assert.deepEqual(Array.from(c.moments, m => m._id), ['pin', 'new']);
  assert.equal(c.loading, false); assert.equal(c.loadingMore, false);
});
test('posting a reply consumes full moment response rather than appending it as a comment', () => {
  let parent;
  const c = feed({ addComment: (id, text, parentId) => { parent = parentId; return { subscribe: observer => observer.next({ data: { _id: id, comments: [{ comment_id: 'reply', parent_id: 'root', comment: text }] } }) }; } });
  const m = { _id: 'post', comments: [{ comment_id: 'root' }] };
  c.commentDrafts.post = 'reply'; c.replyTargets.post = { comment_id: 'root' }; c.sendComment(m);
  assert.equal(parent, 'root'); assert.equal(m.comments[0].comment_id, 'reply'); assert.equal(c.commentDrafts.post, '');
  assert.equal(c.rootComments(m).length, 0);
});
test('failed comment preserves its draft and tags for retry', () => {
  const c = feed({ addComment: () => ({ subscribe: observer => observer.error({ error: { message: 'retry' } }) }) });
  c.commentDrafts.post = 'keep'; c.commentTags.post = ['8']; c.sendComment({ _id: 'post' });
  assert.equal(c.commentDrafts.post, 'keep'); assert.equal(c.commentTags.post[0], '8'); assert.equal(c.sendingComment.post, false); assert.equal(c.actionError, 'retry');
});
test('monetary gifts respect recipient tags, settlement, own posts and already claimed state', () => {
  const c = feed();
  const gift = { _id: 'gift', createdBy: 8, isGrab: true, availableMoney: 10, accessedBy: 'IS_PUBLIC', taggers: [{ id: 7 }], quantityWallet: 2 };
  assert.equal(c.canGrabGift(gift), true);
  gift.taggers = [{ id: 9 }]; assert.equal(c.canGrabGift(gift), false);
  gift.taggers = []; gift.redPacketGrabbedUsers = [7]; assert.equal(c.canGrabGift(gift), false);
  gift.redPacketGrabbedUsers = []; gift.settlementDoneRedPacket = true; assert.equal(c.canGrabGift(gift), false);
});
test('gift creation enforces balance, cents, positive integer quantity and required fields', () => {
  const c = new MakePostComponent({}, {}, {}, {});
  c.me = { wallet: 100 }; c.giftEnabled = true; c.giftTitle = 'gift'; c.giftName = 'name'; c.giftAmount = 1; c.giftQuantity = 2;
  assert.equal(c.giftValid(), true);
  for (const amount of [101, .01, 1.001, NaN, Infinity]) { c.giftAmount = amount; assert.equal(c.giftValid(), false); }
  c.giftAmount = 1; c.giftQuantity = 1.5; assert.equal(c.giftValid(), false);
});
test('createMoment retains explicit people tags, activity and monetary gift payload', () => {
  let result;
  const service = new MomentService({ post: (url, body) => { result = { url, body }; } });
  service.createMoment({ content: 'hello', attachments: [], tags: ['7'], tagUsers: [{ id: '7' }], taggers: [{ id: '7' }], taggerIds: ['7'], activity: 'Feeling', subActivity: 'Happy', gift: { shareMoney: 2, quantityWallet: 2 } });
  assert.equal(result.url, '/inventory/moment'); assert.equal(result.body.tagUsers[0].id, '7'); assert.equal(result.body.activity, 'Feeling'); assert.equal(result.body.redPacketShare, true); assert.equal(result.body.shareMoney, 2);
});
test('reward service uses original inventory and payment routes', () => {
  const calls = []; const service = new MomentService({ get: (url, options) => calls.push({ url, options }), post: (url, body) => calls.push({ url, body }) });
  service.getActiveMomentReward(); service.claimMomentReward(); service.claimCreditReward(); service.getClaimedMomentRewards(2); service.grabMonetaryGift('m', '7');
  assert.deepEqual(calls.map(c => c.url), ['/inventory/moment-reward-fund/get-active', '/inventory/moment-reward-fund/grab', '/inventory/moment-credit-reward/grab', '/payment/moment-reward/claimed', '/inventory/moment/red-packet/grab/m']);
  assert.equal(calls[3].options.params.page, 2); assert.equal(calls[4].body.userId, 7);
});

const { VideoDetailPopupComponent } = load('src/app/pages/social-category-video/video-detail-popup/video-detail-popup.component.ts');
const { VideoFeedbackComponent } = load('src/app/pages/social-video/components/video-feedback/video-feedback.component.ts');
test('category popup replaces comments from full moment response and rejects stale sends', () => {
  const replies = [];
  const c = new VideoDetailPopupComponent({ addComment: () => ({ subscribe: observer => { replies.push(observer); } }) }, {});
  c.video = { momentId: 'first', momentComments: [] }; c.ngOnChanges({ video: {} });
  c.message = 'first'; c.sendComment();
  c.video = { momentId: 'second', momentComments: [] }; c.ngOnChanges({ video: {} });
  replies[0].next({ data: { comments: [{ comment_id: 'old' }] } }); assert.equal(c.comments.length, 0);
  c.message = 'new'; c.sendComment();
  replies[1].next({ data: { comments: [{ comment_id: 'root' }, { comment_id: 'reply', parent_id: 'root' }] } });
  assert.equal(c.comments.length, 1); assert.equal(c.repliesOf('root').length, 1);
});
test('feedback uses original creator and viewer identities; replies preserve parent ID', () => {
  let body; const requests = [];
  const c = new VideoFeedbackComponent({ createVideoFeedback: data => { body = data; return { subscribe: observer => { requests.push(observer); } }; } }, {});
  c.me = { id: 7 }; c.video = { id: 'v', attachmentUrl: '/video', userResponseMoment: { id: 8 } }; c.draft = 'feedback'; c.send();
  assert.equal(body.mainId, 8); assert.equal(body.targetId, 7); assert.equal(body.videoId, 'v');
  requests[0].error({ error: { message: 'retry' } }); assert.equal(c.draft, 'feedback'); assert.equal(c.sending, false);
  c.replyTo = { _id: 'feedback' }; c.send(); assert.equal(body.parentId, 'feedback'); assert.equal(body.createdBy, 7);
});
test('switching feedback tabs ignores a late response from the previous tab', () => {
  const replies = [];
  const c = new VideoFeedbackComponent({ getVideoFeedbacks: () => ({ subscribe: observer => { replies.push(observer); return { unsubscribe() {} }; } }) }, {});
  c.me = { id: 7 }; c.load('MAIN'); c.load('TARGET');
  replies[0].next({ data: { list: [{ _id: 'wrong' }] } }); assert.equal(c.items.length, 0);
  replies[1].next({ data: { list: [{ _id: 'right' }] } }); assert.equal(c.items[0]._id, 'right'); assert.equal(c.loading, false);
});
test('feedback service retains realtime feedback and customer notification routes', () => {
  const calls = []; const service = new MomentService({ get: (url, options) => calls.push({ url, options }), post: (url, body) => calls.push({ url, body }) });
  service.getVideoFeedbacks('7', 'MAIN'); service.createVideoFeedback({ parentId: 'p' }); service.notifyVideoFeedback('8', 'Nam');
  assert.deepEqual(calls.map(c => c.url), ['/realtime/feedback', '/realtime/feedback', '/customer/pushNotification/list']);
  assert.equal(calls[0].options.params.type, 'MAIN'); assert.equal(calls[2].body.pushNotificationRequest[0].messageType, 'FEEDBACK_VIDEO');
});
