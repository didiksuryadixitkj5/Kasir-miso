---
name: Expo project imports
description: Dependency alignment considerations when importing an existing Expo app into this workspace.
---

Imported Expo projects may declare native module versions that are valid for their original environment but do not match the workspace's installed Expo SDK. Run Expo's compatibility check and fix command before relying on the first Metro start.

**Why:** Metro can start while still warning about a native-module mismatch, but the app may fail when that module is loaded in Expo Go.

**How to apply:** After copying an Expo source tree and installing workspace dependencies, run `CI=1 pnpm exec expo install --check`, then `pnpm exec expo install --fix` if needed, and re-run Expo Doctor before restarting the managed workflow.