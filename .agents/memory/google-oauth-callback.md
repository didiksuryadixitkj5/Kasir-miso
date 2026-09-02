---
name: Google OAuth callback handling
description: The Expo web OAuth callback can return to the root route instead of the tab that started login.
---

Keep the Google AuthSession hook mounted at the application root, not only inside the account/settings tab. The callback may navigate back to the default tab, which unmounts a tab-local hook before it can process the OAuth response.

**Why:** A successful Google account selection returned to the Kasir tab while the tab-local account screen never received the response, so the connection was not persisted.

**How to apply:** Put OAuth response handling in a root-level provider/context and let account screens consume the persisted connection state. Keep the redirect URI registered for the active web preview domain.