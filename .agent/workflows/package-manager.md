---
description: package manager preference for this project
---

# Package Manager

This project uses **pnpm** as the package manager.

## Installation

Install pnpm globally:
```bash
# Using Homebrew (recommended on macOS)
brew install pnpm

# Or using npm
npm install -g pnpm
```

## Usage

```bash
# Install dependencies
pnpm install

# Run dev server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Why pnpm?

- **Faster**: More efficient than npm
- **Disk-efficient**: Uses hard links to save disk space
- **Strict**: Better dependency resolution
