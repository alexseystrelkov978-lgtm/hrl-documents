(function (global) {
  const KEY_SECRET = 'hrl_sec_blob';

  try {
    localStorage.removeItem('hrl_pin_hash');
    localStorage.removeItem('hrl_admin_unlock');
  } catch (err) { /* ignore */ }

  function requireAdminUnlock() {
    return true;
  }

  function checkPin() {
    return true;
  }

  function isUnlocked() {
    return true;
  }

  function clearUnlock() {}
  function setUnlockSession() {}
  function setPin() {}

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

  global.HRLSecure = {
    setGithubToken,
    getGithubToken,
    hasGithubToken,
    maskName,
    requireAdminUnlock,
    checkPin,
    isUnlocked,
    clearUnlock,
    setUnlockSession,
    setPin
  };
})(window);
