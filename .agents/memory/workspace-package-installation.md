---
name: Workspace package installation
description: Replit package installer limitation encountered with scoped pnpm workspace dependencies.
---

The automated language-package installer may reject pnpm workspace-root installs and does not accept `--filter` as a package token.

**Why:** Installing a dependency for the Kasir Miso workspace package required multiple failed installer attempts before using a package-scoped pnpm command.

**How to apply:** When adding a dependency to one pnpm workspace package, first use the package-management workflow; if it cannot express a workspace filter, use a narrowly scoped `pnpm --filter <package> add` command and verify the importer section in the lockfile.