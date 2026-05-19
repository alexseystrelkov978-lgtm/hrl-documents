(function (global) {
  const STORAGE_SETTINGS = 'hrl_gh_settings';
  const STORAGE_SITE = 'hrl_site_settings';
  const PUBLIC_REPO = {
    owner: 'alexseystrelkov978-lgtm',
    repo: 'hrl-documents',
    branch: 'main',
    baseUrl: 'https://alexseystrelkov978-lgtm.github.io/hrl-documents'
  };

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function formatMoney(value, currency) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '';
    if (currency === 'USD') {
      return `${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
    }
    return `${n.toLocaleString('ru-RU')} ₸`;
  }

  function formatDateRu(isoDate) {
    if (!isoDate) return '';
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return isoDate;
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  function inlineMd(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  }

  function markdownToHtml(raw) {
    const lines = String(raw).replace(/\r/g, '').split('\n');
    const out = [];
    let inList = false;
    for (const line of lines) {
      if (/^\s*---\s*$/.test(line)) {
        if (inList) { out.push('</ul>'); inList = false; }
        out.push('<hr>');
        continue;
      }
      const li = line.match(/^\s*[-*]\s+(.+)$/);
      if (li) {
        if (!inList) { out.push('<ul>'); inList = true; }
        out.push(`<li>${inlineMd(li[1])}</li>`);
        continue;
      }
      if (inList) { out.push('</ul>'); inList = false; }
      const h = line.match(/^(#{1,3})\s+(.+)$/);
      if (h) out.push(`<h${h[1].length}>${inlineMd(h[2])}</h${h[1].length}>`);
      else if (line.trim()) out.push(`<p>${inlineMd(line)}</p>`);
    }
    if (inList) out.push('</ul>');
    return out.join('');
  }

  function applyTemplate(tpl, data) {
    let out = String(tpl || '');
    Object.entries(data).forEach(([key, value]) => {
      out = out.replaceAll(`{{${key}}}`, String(value ?? ''));
    });
    return out;
  }

  function utf8Base64Encode(obj) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    let binary = '';
    bytes.forEach((b) => { binary += String.fromCharCode(b); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function utf8Base64Decode(encoded) {
    const b64url = decodeURIComponent(encoded).replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64url + '='.repeat((4 - (b64url.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  function readPayloadFromUrl() {
    const encoded = new URLSearchParams(location.search).get('d');
    if (!encoded) return null;
    try {
      return utf8Base64Decode(encoded);
    } catch (err) {
      return null;
    }
  }

  function stripLegacyPlainToken() {
    try {
      const meta = JSON.parse(localStorage.getItem(STORAGE_SETTINGS) || '{}');
      if (!meta.token) return;
      if (global.HRLSecure && !global.HRLSecure.hasGithubToken()) {
        global.HRLSecure.setGithubToken(meta.token);
      }
      delete meta.token;
      localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(meta));
    } catch (err) { /* ignore */ }
  }

  function loadGithubSettings() {
    stripLegacyPlainToken();
    const pub = getPublicRepoConfig();
    const meta = JSON.parse(localStorage.getItem(STORAGE_SETTINGS) || '{}');
    const token = global.HRLSecure?.getGithubToken?.() || '';
    return {
      token: String(token).trim(),
      owner: meta.owner || pub.owner,
      repo: meta.repo || pub.repo,
      branch: meta.branch || pub.branch,
      path: meta.path || ''
    };
  }

  function saveGithubSettings(settings) {
    const pub = getPublicRepoConfig();
    const { token, ...rest } = settings || {};
    if (token && global.HRLSecure) global.HRLSecure.setGithubToken(token);
    const meta = {
      owner: rest.owner || pub.owner,
      repo: rest.repo || pub.repo,
      branch: rest.branch || pub.branch,
      path: rest.path || ''
    };
    localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(meta));
  }

  function getGithubSettings(extraPath) {
    const pub = getPublicRepoConfig();
    const s = loadGithubSettings();
    const path = extraPath || s.path;
    if (!s.owner || !s.repo) return null;
    return {
      token: s.token,
      owner: s.owner,
      repo: s.repo,
      branch: s.branch || 'main',
      path
    };
  }

  function githubHeaders(token, mode) {
    const auth = mode === 'token' ? `token ${token}` : `Bearer ${token}`;
    return { Authorization: auth, Accept: 'application/vnd.github+json' };
  }

  function getRepoRef(fields, defaultPath) {
    const pub = getPublicRepoConfig();
    const stored = loadGithubSettings();
    const owner = String(fields?.owner ?? stored.owner ?? pub.owner ?? '').trim();
    const repo = String(fields?.repo ?? stored.repo ?? pub.repo ?? '').trim();
    const branch = String(fields?.branch ?? stored.branch ?? pub.branch ?? 'main').trim() || 'main';
    const path = String(fields?.path ?? stored.path ?? defaultPath ?? '').trim();
    return { owner, repo, branch, path };
  }

  /** Чтение подписей из публичного репозитория (без token). */
  async function fetchSignedPublic(ref) {
    if (!ref.owner || !ref.repo || !ref.path) return null;
    const url = `https://raw.githubusercontent.com/${ref.owner}/${ref.repo}/${ref.branch}/${ref.path}?t=${Date.now()}`;
    try {
      const resp = await fetch(url);
      if (!resp.ok) return null;
      const list = JSON.parse(await resp.text() || '[]');
      return Array.isArray(list) ? list : [];
    } catch (err) {
      return null;
    }
  }

  async function fetchSignedFromGithub(settings) {
    if (!settings?.token) return null;
    const path = settings.path.split('/').map(encodeURIComponent).join('/');
    const url = `https://api.github.com/repos/${settings.owner}/${settings.repo}/contents/${path}?ref=${encodeURIComponent(settings.branch)}`;
    let resp = await fetch(url, { headers: githubHeaders(settings.token, 'bearer') });
    if (resp.status === 401 || resp.status === 403) {
      resp = await fetch(url, { headers: githubHeaders(settings.token, 'token') });
    }
    if (!resp.ok) return null;
    const file = await resp.json();
    const decoded = atob(String(file.content || '').replace(/\n/g, ''));
    const text = new TextDecoder().decode(Uint8Array.from(decoded, (c) => c.charCodeAt(0)));
    const list = JSON.parse(text || '[]');
    return Array.isArray(list) ? list : [];
  }

  async function pushSignedToGithub(settings, record) {
    const path = settings.path;
    const branch = settings.branch || 'main';
    const contentUrl = `https://api.github.com/repos/${settings.owner}/${settings.repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`;
    let headers = githubHeaders(settings.token, 'bearer');
    let getResp = await fetch(contentUrl, { headers });
    if (getResp.status === 401 || getResp.status === 403) {
      headers = githubHeaders(settings.token, 'token');
      getResp = await fetch(contentUrl, { headers });
    }
    let sha = '';
    let current = [];
    if (getResp.ok) {
      const file = await getResp.json();
      sha = file.sha || '';
      const decoded = atob(String(file.content || '').replace(/\n/g, ''));
      const text = new TextDecoder().decode(Uint8Array.from(decoded, (c) => c.charCodeAt(0)));
      const parsed = JSON.parse(text || '[]');
      if (Array.isArray(parsed)) current = parsed;
    }
    if (!current.find((it) => it.id === record.id && it.signedAt === record.signedAt)) {
      current.push(record);
    }
    const bodyText = JSON.stringify(current, null, 2);
    const bytes = new TextEncoder().encode(bodyText);
    let binary = '';
    bytes.forEach((b) => { binary += String.fromCharCode(b); });
    await fetch(`https://api.github.com/repos/${settings.owner}/${settings.repo}/contents/${encodeURIComponent(path)}`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `sign: ${record.id}`,
        content: btoa(binary),
        branch,
        sha: sha || undefined
      })
    });
  }

  function getSiteBase() {
    const s = JSON.parse(localStorage.getItem(STORAGE_SITE) || '{}');
    if (s.baseUrl) return String(s.baseUrl).replace(/\/$/, '');
    if (location.hostname.includes('github.io')) {
      const path = location.pathname.replace(/\/admin\/.*$/, '').replace(/\/sign\/.*$/, '').replace(/\/$/, '');
      return `${location.origin}${path}`;
    }
    return PUBLIC_REPO.baseUrl;
  }

  function getPublicRepoConfig() {
    const s = JSON.parse(localStorage.getItem(STORAGE_SITE) || '{}');
    return {
      owner: s.owner || PUBLIC_REPO.owner,
      repo: s.repo || PUBLIC_REPO.repo,
      branch: s.branch || PUBLIC_REPO.branch,
      baseUrl: getSiteBase()
    };
  }

  /** Только данные документа — без токенов и служебных полей (для клиента). */
  function buildClientDocPayload(data) {
    const { tpl, gh, ...rest } = data || {};
    return { ...rest };
  }

  function buildSignLink(docType, payload) {
    const url = new URL(`${getSiteBase()}/sign/${docType}.html`);
    url.searchParams.set('d', utf8Base64Encode(buildClientDocPayload(payload)));
    return url.href;
  }

  function buildSignLinkById(docType, id) {
    return `${getSiteBase()}/sign/${docType}.html?id=${encodeURIComponent(id)}`;
  }

  function makeSignId(docType) {
    return `${docType}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  async function savePendingDoc(ghSettings, id, payload) {
    if (!ghSettings?.token) return;
    const path = `data/pending/${id}.json`;
    const bodyText = JSON.stringify(buildClientDocPayload(payload), null, 2);
    const contentUrl = `https://api.github.com/repos/${ghSettings.owner}/${ghSettings.repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(ghSettings.branch || 'main')}`;
    let headers = githubHeaders(ghSettings.token, 'bearer');
    let getResp = await fetch(contentUrl, { headers });
    if (getResp.status === 401 || getResp.status === 403) {
      headers = githubHeaders(ghSettings.token, 'token');
      getResp = await fetch(contentUrl, { headers });
    }
    let sha = '';
    if (getResp.ok) {
      const file = await getResp.json();
      sha = file.sha || '';
    }
    const bytes = new TextEncoder().encode(bodyText);
    let binary = '';
    bytes.forEach((b) => { binary += String.fromCharCode(b); });
    await fetch(`https://api.github.com/repos/${ghSettings.owner}/${ghSettings.repo}/contents/${encodeURIComponent(path)}`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `pending: ${id}`,
        content: btoa(binary),
        branch: ghSettings.branch || 'main',
        sha: sha || undefined
      })
    });
  }

  async function loadPendingDoc(id) {
    const cfg = getPublicRepoConfig();
    const url = `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${cfg.branch}/data/pending/${encodeURIComponent(id)}.json?t=${Date.now()}`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    return resp.json();
  }

  async function readSignPayloadFromUrl() {
    const params = new URLSearchParams(location.search);
    const id = params.get('id');
    if (id) return loadPendingDoc(id);
    return readPayloadFromUrl();
  }

  function signingExtras(data, reportDate) {
    const signedDateText = reportDate
      ? new Date(`${reportDate}T09:00:00`).toLocaleString('ru-RU')
      : new Date().toLocaleString('ru-RU');
    return {
      executorSignature: 'HR & Legal Services [ЭП]',
      executorSignDate: signedDateText,
      clientSignature: 'Будет проставлена после подтверждения',
      clientSignDate: 'Ожидает подписания',
      electronicSeal: `HRLS-${String(data.docNo || data.id || '').trim()}-${String(reportDate || '').replaceAll('-', '')}`
    };
  }

  function setStatus(el, msg, type) {
    if (!el) return;
    el.textContent = msg;
    el.className = `status ${type || ''}`;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function shortenUrl(longUrl) {
    const url = String(longUrl || '').trim();
    if (!url) return '';

    try {
      const res1 = await fetch(
        'https://is.gd/create.php?format=simple&url=' + encodeURIComponent(url)
      );
      if (res1.ok) {
        const text = (await res1.text()).trim();
        if (text.startsWith('http')) return text;
      }
    } catch (err) {
      /* fallback */
    }

    try {
      const res2 = await fetch(
        'https://tinyurl.com/api-create.php?url=' + encodeURIComponent(url)
      );
      if (res2.ok) {
        const text = (await res2.text()).trim();
        if (text.startsWith('http')) return text;
      }
    } catch (err) {
      /* no shortener */
    }

    return '';
  }

  global.HRL = {
    escapeHtml,
    formatMoney,
    formatDateRu,
    markdownToHtml,
    applyTemplate,
    utf8Base64Encode,
    utf8Base64Decode,
    readPayloadFromUrl,
    readSignPayloadFromUrl,
    getSiteBase,
    getPublicRepoConfig,
    buildSignLinkById,
    makeSignId,
    savePendingDoc,
    loadPendingDoc,
    loadGithubSettings,
    saveGithubSettings,
    buildClientDocPayload,
    getGithubSettings,
    getRepoRef,
    fetchSignedPublic,
    fetchSignedFromGithub,
    pushSignedToGithub,
    buildSignLink,
    signingExtras,
    setStatus,
    sleep,
    shortenUrl,
    STORAGE_SETTINGS
  };
})(window);
