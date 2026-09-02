---
name: Web confirmation for native alert flows
description: Cross-platform confirmation behavior for Expo screens that use native Alert dialogs.
---

React Native's native Alert dialog is not a reliable confirmation mechanism on the web preview. Destructive actions that must be testable and usable on web should use a web confirmation branch while retaining Alert.alert for native platforms.

**Why:** The cancellation action appeared wired correctly but did nothing in the web preview because the native three-button Alert behavior was unavailable there.

**How to apply:** For important destructive actions in Expo screens, branch on Platform.OS === 'web' and use the browser confirmation API or an explicit web modal; keep the native Alert path for Android and iOS.