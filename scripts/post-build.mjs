#!/usr/bin/env node
/**
 * Post-build script for Cloudflare Pages deployment
 * Fixes static asset paths for @opennextjs/cloudflare v1.2.1
 */

import { cpSync, writeFileSync, existsSync, symlinkSync, unlinkSync } from 'fs';
import { join } from 'path';

const openNextDir = join(process.cwd(), '.open-next');
const assetsDir = join(openNextDir, 'assets');

if (!existsSync(assetsDir)) {
  console.error('Error: .open-next/assets directory not found. Run build first.');
  process.exit(1);
}

// Copy assets to root of .open-next for Pages compatibility
console.log('Copying assets to .open-next root...');
cpSync(assetsDir, openNextDir, { recursive: true });

// Create _routes.json for Pages routing
const routesJson = {
  version: 1,
  include: ['/*'],
  exclude: [
    '/_next/static/*',
    '/favicon.ico',
    '/favicon.svg',
    '/images/*',
    '/background-images/*',
    '/apple-touch-icon.png',
    '/apple-touch-icon.svg',
    '/favicon-16x16.png',
    '/favicon-32x32.png',
    '/BUILD_ID',
  ],
};

console.log('Creating _routes.json...');
writeFileSync(join(openNextDir, '_routes.json'), JSON.stringify(routesJson, null, 2));

// Create _worker.js symlink for Pages
const workerPath = join(openNextDir, 'worker.js');
const workerSymlink = join(openNextDir, '_worker.js');

if (existsSync(workerPath)) {
  console.log('Creating _worker.js symlink...');
  try {
    if (existsSync(workerSymlink)) {
      unlinkSync(workerSymlink);
    }
    symlinkSync('worker.js', workerSymlink);
  } catch (e) {
    console.error('Failed to create symlink:', e.message);
  }
}

console.log('Post-build complete!');
