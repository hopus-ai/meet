#!/usr/bin/env node
/**
 * Post-build script for Cloudflare Pages deployment
 * Fixes static asset paths and symlinks for @opennextjs/cloudflare v1.2.1
 */

import { cpSync, writeFileSync, existsSync, copyFileSync, unlinkSync, readdirSync, lstatSync, readlinkSync, mkdirSync, rmSync } from 'fs';
import { join, dirname, resolve } from 'path';

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

// Copy worker.js to _worker.js for Pages (symlinks not supported)
const workerPath = join(openNextDir, 'worker.js');
const workerCopy = join(openNextDir, '_worker.js');

if (existsSync(workerPath)) {
  console.log('Copying worker.js to _worker.js...');
  try {
    if (existsSync(workerCopy)) {
      unlinkSync(workerCopy);
    }
    copyFileSync(workerPath, workerCopy);
  } catch (e) {
    console.error('Failed to copy worker.js:', e.message);
  }
}

/**
 * Find all symlinks recursively in a directory
 */
function findSymlinks(dir, symlinks = []) {
  if (!existsSync(dir)) return symlinks;

  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      try {
        const stat = lstatSync(fullPath);
        if (stat.isSymbolicLink()) {
          symlinks.push(fullPath);
        } else if (stat.isDirectory()) {
          findSymlinks(fullPath, symlinks);
        }
      } catch (e) {
        // Skip inaccessible entries
      }
    }
  } catch (e) {
    // Skip inaccessible directories
  }

  return symlinks;
}

/**
 * Replace a symlink with a copy of its target
 */
function dereferenceSymlink(symlinkPath) {
  try {
    const target = readlinkSync(symlinkPath);
    const absoluteTarget = resolve(dirname(symlinkPath), target);

    // Check if target exists
    if (!existsSync(absoluteTarget)) {
      console.warn(`  Warning: Symlink target does not exist: ${absoluteTarget}`);
      unlinkSync(symlinkPath);
      return false;
    }

    const targetStat = lstatSync(absoluteTarget);

    // Remove the symlink
    unlinkSync(symlinkPath);

    if (targetStat.isDirectory()) {
      // Copy directory
      cpSync(absoluteTarget, symlinkPath, { recursive: true, dereference: true });
    } else {
      // Copy file
      copyFileSync(absoluteTarget, symlinkPath);
    }

    return true;
  } catch (e) {
    console.error(`  Error dereferencing ${symlinkPath}: ${e.message}`);
    return false;
  }
}

// Dereference all symlinks in .open-next directory
console.log('Finding and resolving symlinks...');
const symlinks = findSymlinks(openNextDir);

if (symlinks.length > 0) {
  console.log(`Found ${symlinks.length} symlinks to dereference...`);

  let resolved = 0;
  let failed = 0;

  for (const symlink of symlinks) {
    if (dereferenceSymlink(symlink)) {
      resolved++;
    } else {
      failed++;
    }
  }

  console.log(`Resolved ${resolved} symlinks, ${failed} failed/skipped`);
} else {
  console.log('No symlinks found');
}

console.log('Post-build complete!');
