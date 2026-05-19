(function () {
  const docType = document.body.dataset.docType;
  const meta = window.HRL_META[docType];
  if (!meta) return;

  const DURATION_MS = 2500;
  const CIRC = 377;
  const bodyEl = document.getElementById('docBody');
  const docMeta = document.getElementById('docMeta');
  const scanner = document.getElementById('scanner');
  const scanCard = document.getElementById('scanCard');
  const progressBar = document.getElementById('progressBar');
  const scanText = document.getElementById('scanText');
  const scanStage = document.getElementById('scanStage');
  const successBanner = document.getElementById('successBanner');
  const successTime = document.getElementById('successTime');
  const signatureBox = document.getElementById('signatureBox');
  const scannerIcon = document.getElementById('scannerIcon');

  let payload = null;
  let holdStart = 0;
  let holding = false;
  let rafId = 0;

  const hasLinkParam = Boolean(
    new URLSearchParams(location.search).get('id') ||
    new URLSearchParams(location.search).get('d')
  );

  function showInvalidLink() {
    if (bodyEl) {
      bodyEl.innerHTML = '<p style="text-align:center;color:#666;padding:24px">Ссылка недействительна или устарела.<br>Запросите новую ссылку на подпись у администратора.</p>';
    }
    if (scanCard) scanCard.style.display = 'none';
  }

  function render() {
    if (!payload) return;
    const tpl = window.HRL_TEMPLATES[docType] || '';
    const text = HRL.applyTemplate(tpl, payload);
    bodyEl.innerHTML = HRL.markdownToHtml(text);
    const label = payload.docNo || payload.id || '—';
    docMeta.textContent = `${label} • ${new Date().toLocaleDateString('ru-RU')}`;
  }

  function initialsFromFio(fio) {
    const parts = String(fio || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'КЛ';
    return parts.slice(0, 2).map((p) => p[0].toUpperCase()).join('');
  }

  function applySigned(isoTime, already) {
    const signedAtText = new Date(isoTime).toLocaleString('ru-RU');
    if (scanner) {
      scanner.classList.remove('scanning');
      scanner.classList.add('success');
      if (scannerIcon) scannerIcon.textContent = '✓';
    }
    if (scanText) scanText.textContent = already ? 'Уже подтверждено' : 'Подтверждено';
    if (scanStage) scanStage.textContent = already ? 'Ранее зарегистрировано.' : 'Запись сохранена.';
    if (successBanner) {
      successBanner.classList.add('active');
      successTime.textContent = `Время: ${signedAtText}`;
    }
    payload.clientSignature = `${payload.fio || 'Клиент'} [ЭП]`;
    payload.clientSignDate = signedAtText;
    render();
    if (signatureBox) {
      signatureBox.classList.add('active');
      signatureBox.innerHTML = `Подпись: <strong>${initialsFromFio(payload.fio)} [ЭП]</strong> • ${signedAtText}`;
    }
  }

  function restoreIfSigned() {
    const list = JSON.parse(localStorage.getItem(meta.storageSigned) || '[]');
    const found = list.find((it) => it.id === (payload.id || payload.docNo));
    if (found) applySigned(found.signedAt, true);
  }

  function onPointerDown(e) {
    if (successBanner?.classList.contains('active')) return;
    e.preventDefault();
    holding = true;
    holdStart = performance.now();
    scanner.classList.add('scanning');
    scanText.textContent = 'Сканирование...';
    scanStage.textContent = 'Проверка...';
    rafId = requestAnimationFrame(tick);
  }

  function onPointerUp() {
    if (!holding) return;
    holding = false;
    cancelAnimationFrame(rafId);
    scanner.classList.remove('scanning');
    progressBar.style.strokeDashoffset = String(CIRC);
    scanText.textContent = 'Нажмите и удерживайте';
    scanStage.textContent = 'Ожидание.';
  }

  function tick(now) {
    if (!holding) return;
    const p = Math.min(1, (now - holdStart) / DURATION_MS);
    progressBar.style.strokeDashoffset = String(CIRC - CIRC * p);
    if (p >= 1) {
      holding = false;
      completeSign();
      return;
    }
    rafId = requestAnimationFrame(tick);
  }

  async function completeSign() {
    const id = payload.id || payload.docNo;
    const list = JSON.parse(localStorage.getItem(meta.storageSigned) || '[]');
    const exists = list.find((it) => it.id === id);
    if (exists) {
      applySigned(exists.signedAt, true);
      return;
    }
    const signedAt = new Date().toISOString();
    const record = { id, docType, fio: payload.fio || '', signedAt };
    list.push(record);
    localStorage.setItem(meta.storageSigned, JSON.stringify(list));
    localStorage.setItem('hrl_last_signed_ping', String(Date.now()));
    applySigned(signedAt, false);
    if (navigator.vibrate) navigator.vibrate([40, 80, 40]);
    launchConfetti();
  }

  function launchConfetti() {
    const canvas = document.getElementById('confetti');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const pieces = Array.from({ length: 70 }, () => ({
      x: Math.random() * canvas.width,
      y: -10 - Math.random() * 200,
      s: 4 + Math.random() * 8,
      v: 2 + Math.random() * 4,
      r: Math.random() * Math.PI,
      c: ['#00c853', '#1a3a5c', '#f0c419'][Math.floor(Math.random() * 3)]
    }));
    const start = performance.now();
    function draw(now) {
      const t = now - start;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach((p) => {
        p.y += p.v;
        p.x += Math.sin(p.y / 28);
        ctx.fillStyle = p.c;
        ctx.fillRect(p.x, p.y, p.s, p.s * 0.6);
      });
      if (t < 1600) requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    requestAnimationFrame(draw);
  }

  function setupBiometric() {
    if (!meta.needsBiometric) {
      if (scanCard) scanCard.style.display = 'none';
      return;
    }
    if (!scanner || !progressBar) return;
    if (scannerIcon) {
      scannerIcon.innerHTML = '<svg viewBox="0 0 64 64" width="48" height="48" stroke="#1a3a5c" fill="none"><path d="M32 8c-8 0-14 6-14 14v8"/><path d="M32 20c-2.4 0-4 1.8-4 4.2V40"/><path d="M18 42c0 7.6 6 14 14 14s14-6.4 14-14"/></svg>';
    }
    scanner.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  }

  document.getElementById('downloadBtn')?.addEventListener('click', () => {
    if (!payload) return;
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${payload.id}</title></head><body>${bodyEl.innerHTML}</body></html>`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    a.download = `${docType}-${String(payload.id).replace(/[^\w.-]+/g, '_')}.html`;
    a.click();
  });
  document.getElementById('printBtn')?.addEventListener('click', () => window.print());

  async function init() {
    payload = await HRL.readSignPayloadFromUrl();
    if (!payload || payload.docType !== docType) {
      if (hasLinkParam) {
        showInvalidLink();
        return;
      }
      payload = {
        docType,
        id: 'DEMO',
        docNo: 'DEMO-001',
        fio: 'Демо (только для проверки админом)',
        reportDate: new Date().toISOString().slice(0, 10),
        reportDateText: HRL.formatDateRu(new Date().toISOString().slice(0, 10)),
        blockedKztText: '1 500 000 ₸',
        claimAmountText: '1 500 000 ₸',
        courtName: '__________________________',
        plaintiffName: 'Истец',
        plaintiffAddress: 'Адрес',
        plaintiffPhone: '+7',
        defendantName: 'Ответчик',
        birthYear: '1950',
        investUsdText: '0 ₸',
        cryptoUsdText: '0 ₸',
        euroUsdText: '0 ₸',
        activeUsdTotalText: '0 ₸',
        ...HRL.signingExtras({ docNo: 'DEMO-001' }, new Date().toISOString().slice(0, 10))
      };
    }

    render();
    restoreIfSigned();
    setupBiometric();
  }

  init();
})();
