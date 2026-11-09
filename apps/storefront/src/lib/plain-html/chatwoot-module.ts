/**
 * The Chatwoot app's chat on a plain HTML page (`modules.ts`): what `ChatwootWidget` does on the
 * React page, as plain JS. The inline island loads it once the cookie category the store picked
 * allows it (`necessary`: for everyone) and the page has loaded. It loads Chatwoot's own website
 * SDK from the store's Chatwoot, starts it with the inbox's website token, and tells it who is
 * chatting: the signed-in shopper (signed on the server), or nobody after a sign-out.
 *
 * Config: `{ baseUrl, websiteToken, identity }` (`ChatwootIdentity` or null).
 */
export const CHATWOOT_MODULE = `window.__commerceIsland && window.__commerceIsland('chatwoot', function (c, api) {
  if (window.$chatwoot) return;
  var KEY = 'commerce:chatwoot-user';
  function identify() {
    var chat = window.$chatwoot;
    if (!chat) return;
    var id = c.identity;
    try {
      if (id) {
        var user = { identifier_hash: id.identifierHash };
        if (id.name) user.name = id.name;
        if (id.email) user.email = id.email;
        if (id.phone) user.phone_number = id.phone;
        chat.setUser(id.identifier, user);
        chat.setCustomAttributes(id.attributes);
        localStorage.setItem(KEY, id.identifier);
      } else if (localStorage.getItem(KEY)) {
        chat.reset();
        localStorage.removeItem(KEY);
      }
    } catch (e) {}
  }
  window.addEventListener('chatwoot:ready', identify);
  window.chatwootSettings = Object.assign({ position: 'right', type: 'standard' }, window.chatwootSettings || {});
  var s = document.createElement('script');
  if (api.nonce) s.nonce = api.nonce;
  s.async = true;
  s.id = 'chatwoot-sdk';
  s.src = c.baseUrl + '/packs/js/sdk.js';
  s.onload = function () {
    if (window.chatwootSDK) window.chatwootSDK.run({ websiteToken: c.websiteToken, baseUrl: c.baseUrl });
  };
  document.head.appendChild(s);
});
`
