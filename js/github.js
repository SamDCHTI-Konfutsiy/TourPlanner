/* ============================================================
   Karvon — github.js
   Publishes the admin's working copy back to the repository.

   SECURITY, stated plainly:
   GitHub Pages serves static files only. There is no server here
   to hold a secret, so there is no way to store a write-capable
   token that a determined visitor could not read. This module
   therefore never stores a token in the repository, in the source,
   or in localStorage. The admin pastes a fine-grained token at the
   start of each session, it lives in sessionStorage, and it is gone
   when the tab closes. Anyone who can reach /admin still cannot do
   anything without their own token.
   ============================================================ */

const GH_TOKEN_KEY = 'karvon:token';
const GH_CONFIG_KEY = 'karvon:gh';
const GH_API = 'https://api.github.com';

const GitHubStore = {
  get token() {
    return sessionStorage.getItem(GH_TOKEN_KEY) || '';
  },
  set token(value) {
    if (value) sessionStorage.setItem(GH_TOKEN_KEY, value);
    else sessionStorage.removeItem(GH_TOKEN_KEY);
  },

  get config() {
    try {
      return JSON.parse(localStorage.getItem(GH_CONFIG_KEY) || '{}');
    } catch (_) {
      return {};
    }
  },
  set config(value) {
    localStorage.setItem(GH_CONFIG_KEY, JSON.stringify(value));
  },

  get connected() {
    const c = this.config;
    return Boolean(this.token && c.owner && c.repo);
  },

  forget() {
    this.token = '';
  },
};

/* UTF-8 safe base64 — btoa alone mangles the Uzbek and Chinese text. */
function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function fromBase64(b64) {
  const binary = atob(b64.replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function ghFetch(path, options = {}) {
  const { owner, repo } = GitHubStore.config;
  if (!GitHubStore.token) throw new Error('No token in this session. Connect first.');
  if (!owner || !repo) throw new Error('Repository owner and name are not set.');

  const res = await fetch(`${GH_API}/repos/${owner}/${repo}${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${GitHubStore.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) throw new Error('GitHub rejected the token. It may be wrong or expired.');
  if (res.status === 403) throw new Error('GitHub refused the request. Check the token has Contents: write on this repository.');
  if (res.status === 404 && options.method !== 'GET' && options.method) {
    throw new Error('Repository or branch not found. Check the owner, name and branch.');
  }
  return res;
}

/** Read a file. Returns null when the file does not exist yet. */
async function ghGetFile(path) {
  const { branch = 'main' } = GitHubStore.config;
  const res = await ghFetch(`/contents/${encodeURI(path)}?ref=${encodeURIComponent(branch)}`, { method: 'GET' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Could not read ${path} (HTTP ${res.status}).`);
  const json = await res.json();
  return { sha: json.sha, text: json.content ? fromBase64(json.content) : '' };
}

/** Create or update a text file. */
async function ghPutText(path, text, message) {
  const existing = await ghGetFile(path);
  return ghPutBase64(path, toBase64(text), message, existing ? existing.sha : null);
}

/** Create or update a file from base64 content — used for image uploads. */
async function ghPutBase64(path, base64, message, sha = null) {
  const { branch = 'main' } = GitHubStore.config;
  const res = await ghFetch(`/contents/${encodeURI(path)}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: message || `Update ${path}`,
      content: base64,
      branch,
      ...(sha ? { sha } : {}),
    }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.message || `Could not write ${path} (HTTP ${res.status}).`);
  }
  return res.json();
}

/** Confirm the token works and the repository is reachable. */
async function ghVerify() {
  const res = await ghFetch('', { method: 'GET' });
  if (!res.ok) throw new Error('Repository not found, or the token cannot see it.');
  const repo = await res.json();
  if (repo.permissions && !repo.permissions.push) {
    throw new Error('This token can read the repository but not write to it.');
  }
  return repo;
}

/** Upload an image file, returning the repository-relative path to store in JSON. */
async function ghUploadImage(file, folder) {
  const safeName = file.name
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-|-$/g, '');
  const path = `assets/images/${folder}/${Date.now()}-${safeName}`;

  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });

  await ghPutBase64(path, base64, `Add image ${path}`);
  return path;
}
