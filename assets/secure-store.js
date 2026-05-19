(function (global) {
  const KEY_UNLOCK = 'hrl_admin_unlock';
  const KEY_SECRET = 'hrl_sec_blob';
  const KEY_PIN_HASH = 'hrl_pin_hash';
  const DEFAULT_PIN = '4729';

  function hashPin(pin) {
    let h = 0;
    const s = String(pin);
    for (let i = 0; i < s.length; i += 1) {
      h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    }
    return String(Math.abs(h));
  }

  function xorEncode(text) {
    const key = 'hrl-local-v1';
    const bytes = new TextEncoder().encode(String(text));
    let out = '';
    for (let i = 0; i < bytes.length; i += 1) {
      out += String.fromCharCode(bytes[i] ^ key.charCodeAt(i % key.length));
    }
    return btoa(out).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function xorDecode(encoded) {
    if (!encoded) return '';
    try {
      const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
      const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
      const binary = atob(padded);
      const key = 'hrl-local-v1';
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i) ^ key.charCodeAt(i % key.length);
      }
      return new TextDecoder().decode(bytes);
    } catch (err) {
      return '';
    }
  }

  function setUnlockSession() {
    sessionStorage.setItem(KEY_UNLOCK, String(Date.now()));
  }

  function isUnlocked() {
    return Boolean(sessionStorage.getItem(KEY_UNLOCK));
  }

  function clearUnlock() {
    sessionStorage.removeItem(KEY_UNLOCK);
  }

  function setPin(pin) {
    localStorage.setItem(KEY_PIN_HASH, hashPin(pin));
  }

  function checkPin(pin) {
    const stored = localStorage.getItem(KEY_PIN_HASH);
    if (!stored) {
      setPin(DEFAULT_PIN);
      return String(pin) === DEFAULT_PIN;
    }
    return hashPin(pin) === stored;
  }

  function setGithubToken(token) {
    const t = String(token || '').trim();
    if (!t) return;
    localStorage.setItem(KEY_SECRET, xorEncode(t));
  }

  function getGithubToken() {
    return xorDecode(localStorage.getItem(KEY_SECRET) || '');
  }

  function hasGithubToken() {
    return Boolean(getGithubToken());
  }

  function maskName(fio) {
    const parts = String(fio || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '—';
    if (parts.length === 1) return `${parts[0][0]}.***`;
    return `${parts[0][0]}. ${parts[1][0]}.***`;
  }

  function requireAdminUnlock(redirectTo) {
    if (isUnlocked()) return true;
    const base = location.pathname.replace(/\/admin\/[^/]+$/, '');
    const unlock = `${base}/admin/unlock.html`;
    location.replace(unlock + (redirectTo ? `?next=${encodeURIComponent(redirectTo)}` : ''));
    return false;
  }

  global.HRLSecure = {
    setUnlockSession,
    isUnlocked,
    clearUnlock,
    setPin,
    checkPin,
    setGithubToken,
    getGithubToken,
    hasGithubToken,
    maskName,
    requireAdminUnlock,
    DEFAULT_PIN
  };
})(window);
