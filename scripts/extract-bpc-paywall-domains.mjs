#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

function usage() {
  console.error('Usage: node scripts/extract-bpc-paywall-domains.mjs <bpc-root> [output-path]');
}

const [, , inputRoot, outputPathArg] = process.argv;
if (!inputRoot) {
  usage();
  process.exit(1);
}

const outputPath = outputPathArg || path.join(process.cwd(), 'lib/discovery/paywall-domain-corpus.generated.json');
const sitesPath = path.join(inputRoot, 'sites.js');
const updatedPath = path.join(inputRoot, 'sites_updated.json');
const customPath = path.join(inputRoot, 'custom', 'sites_custom.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeDomain(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  if (!normalized || /\s/.test(normalized)) return null;
  if (!/[a-z0-9-]+\.[a-z]{2,}$/i.test(normalized)) return null;
  return normalized;
}

function collectDomains(record) {
  return Object.values(record || {}).flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const domains = [];

    if (typeof entry.domain === 'string') {
      const normalized = normalizeDomain(entry.domain);
      if (normalized) domains.push(normalized);
    }

    if (Array.isArray(entry.group)) {
      for (const value of entry.group) {
        const normalized = normalizeDomain(value);
        if (normalized) domains.push(normalized);
      }
    } else if (typeof entry.group === 'string') {
      for (const value of entry.group.split(',')) {
        const normalized = normalizeDomain(value);
        if (normalized) domains.push(normalized);
      }
    }

    return domains;
  });
}

const fakeApi = { runtime: { getManifest: () => ({ manifest_version: 3 }) } };
const context = { chrome: fakeApi, browser: fakeApi };
vm.createContext(context);
vm.runInContext(fs.readFileSync(sitesPath, 'utf8'), context);

const defaultDomains = [...new Set(collectDomains(context.defaultSites || {}))].sort();
const updatedDomains = [...new Set(collectDomains(readJson(updatedPath)))].sort();
const customDomains = [...new Set(collectDomains(readJson(customPath)))].sort();
const combinedDomains = [...new Set([...defaultDomains, ...updatedDomains, ...customDomains])].sort();

const output = {
  source: 'bypass-paywalls-chrome-clean',
  generatedAt: new Date().toISOString(),
  counts: {
    defaultDomains: defaultDomains.length,
    updatedDomains: updatedDomains.length,
    customDomains: customDomains.length,
    combinedDomains: combinedDomains.length
  },
  defaultDomains,
  updatedDomains,
  customDomains,
  combinedDomains
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n');
console.log(`Wrote ${output.counts.combinedDomains} domains to ${outputPath}`);
