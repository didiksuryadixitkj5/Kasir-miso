---
name: Google OAuth callback handling
description: The Expo web OAuth callback can return to the root route instead of the tab that started login.
---

Keep the Google AuthSession hook mounted at the application root, not only inside the account/settings tab. On web, call `WebBrowser.maybeCompleteAuthSession()` at module startup. The callback may navigate back to the default tab, which unmounts a tab-local hook before it can process the OAuth response.

**Why:** A successful Google account selection returned to the Kasir tab while the tab-local account screen never received the response. Web also needs explicit auth-session completion, and initial AsyncStorage hydration must not overwrite a freshly handled OAuth result.

**How to apply:** Put OAuth response handling in a root-level provider/context, complete the web auth session at startup, and guard hydration against racing with the callback. Let account screens consume persisted state and keep the active web redirect URI registered.