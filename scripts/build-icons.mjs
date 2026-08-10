#!/usr/bin/env node
/**
 * Rasterises the PNG icons from `favicon.svg`.
 *
 *   npm run build-icons
 *
 * iOS ignores SVG favicons, so a home-screen shortcut has to have a PNG; the manifest wants
 * one too. Generating them from the single SVG means the monogram cannot drift between
 * formats, and rerunning this is the whole update process if the mark ever changes.
 *
 * Uses the Chromium that Playwright already installs — no image library in the dependency
 * tree for three files that change approximately never. Output is committed, so a normal
 * build does not depend on this running.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const PUBLIC = new URL('../packages/web/public/', import.meta.url).pathname;
const svg = readFileSync(`${PUBLIC}favicon.svg`, 'utf8');

// 180 is what iOS asks for; 192 and 512 are the manifest's usual pair.
const SIZES = [
  [180, 'apple-touch-icon.png'],
  [192, 'icon-192.png'],
  [512, 'icon-512.png'],
];

const browser = await chromium.launch();
for (const [size, name] of SIZES) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<style>html,body{margin:0;padding:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  // Not omitBackground: the icon's own dark square is the background, and a transparent
  // one would show through as white on an iOS home screen.
  writeFileSync(`${PUBLIC}${name}`, await page.screenshot());
  console.log(`✓ ${name} (${size}x${size})`);
  await page.close();
}
await browser.close();
