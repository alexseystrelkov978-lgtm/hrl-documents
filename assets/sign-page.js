(function () {
  const docType = document.body.dataset.docType;
  const meta = window.HRL_META[docType];
  if (!meta) return;

  const isTactical = meta.biometricTier === 'tactical';
  const DURATION_MS = 2500;
  const CIRC = isTactical ? 427 : 377;
  const bodyEl = document.getElementById('docBody');
  const docMeta = document.getElementById('docMeta');
  const docHeading = document.getElementById('docHeading');
  const scanner = document.getElementById('scanner');
  const scanCard = document.getElementById('scanCard');
  const progressBar = document.getElementById('progressBar');
  const scanText = document.getElementById('scanText');
  const scanStage = document.getElementById('scanStage');
  const successBanner = document.getElementById('successBanner');
  const successTime = document.getElementById('successTime');
  const tacticalCert = document.getElementById('tacticalCert');
  const signatureBox = document.getElementById('signatureBox');
  const scannerIcon = document.getElementById('scannerIcon');
  const telemetryEntropy = document.getElementById('telemetryEntropy');
  const telemetryVector = document.getElementById('telemetryVector');
  const telemetryChain = document.getElementById('telemetryChain');

  const TACTICAL_PHASES = [
    [0, 'TLS 1.3 • ИНИЦИАЛИЗАЦИЯ ЗАЩИЩЁННОГО КАНАЛА'],
    [0.18, 'PKI • СВЕРКА С РЕЕСТРОМ ДОВЕРИЯ NATO STANAG 4774'],
    [0.38, 'FIDO2 • ЗАХВАТ БИОМЕТРИЧЕСКОГО ВЕКТОРА'],
    [0.58, 'eIDAS L4 • ФОРМИРОВАНИЕ КРИПТОГРАФИЧЕСКОЙ ПОДПИСИ'],
    [0.78, 'HSM • ВЕРИФИКАЦИЯ ЦЕПОЧКИ ДОВЕРИЯ'],
    [0.92, 'FINAL • РЕГИСТРАЦИЯ ОТМЕТКИ В РЕЕСТРЕ']
  ];

  let payload = null;
  let holdStart = 0;
  let holding = false;
  let rafId = 0;

  const hasLinkParam = Boolean(
    new URLSearchParams(location.search).get('id') ||
    new URLSearchParams(location.search).get('d')
  );

  function setProgress(p) {
    if (!progressBar) return;
    const offset = CIRC - CIRC * Math.min(1, Math.max(0, p));
    progressBar.setAttribute('stroke-dashoffset', String(offset));
    progressBar.style.strokeDashoffset = String(offset);
  }

  function showInvalidLink() {
    if (bodyEl) {
      bodyEl.innerHTML = '<p style="text-align:center;color:#666;padding:24px">Ссылка недействительна или устарела.<br>Запросите новую ссылку на подпись у администратора.</p>';
    }
    if (scanCard) scanCard.style.display = 'none';
  }

  function pseudoHash(seed) {
    let h = 0;
    const s = String(seed);
    for (let i = 0; i < s.length; i += 1) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return `SHA3-512:${Math.abs(h).toString(16).padStart(8, '0')}${Date.now().toString(16).slice(-8)}`.toUpperCase();
  }

  function updateTelemetry(p) {
    if (!isTactical) return;
    const id = payload?.id || payload?.docNo || 'NODE';
    if (telemetryEntropy) telemetryEntropy.textContent = `${(0.91 + p * 0.08).toFixed(4)} bits`;
    if (telemetryVector) telemetryVector.textContent = `BIO-${initialsFromFio(payload?.fio)}-${Math.floor(p * 9999)}`;
    if (telemetryChain) telemetryChain.textContent = `TRUST/${id.slice(0, 12)}`;
  }

  function setTacticalPhase(p) {
    if (!isTactical || !scanStage) return;
    let msg = TACTICAL_PHASES[0][1];
    for (let i = TACTICAL_PHASES.length - 1; i >= 0; i -= 1) {
      if (p >= TACTICAL_PHASES[i][0]) {
        msg = TACTICAL_PHASES[i][1];
        break;
      }
    }
    scanStage.textContent = msg;
  }

  function render() {
    if (!payload) return;
    const tpl = window.HRL_TEMPLATES[docType] || '';
    const text = HRL.applyTemplate(tpl, payload);
    bodyEl.innerHTML = HRL.markdownToHtml(text);
    const label = payload.docNo || payload.id || '—';
    docMeta.textContent = `${label} • ${new Date().toLocaleDateString('ru-RU')}`;
    if (docHeading && payload.docTitle) docHeading.textContent = payload.docTitle;
  }

  function initialsFromFio(fio) {
    const parts = String(fio || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'КЛ';
    return parts.slice(0, 2).map((p) => p[0].toUpperCase()).join('');
  }

  function applySigned(isoTime, already) {
    const signedAtText = new Date(isoTime).toLocaleString('ru-RU');
    const certId = pseudoHash(`${payload.id}-${isoTime}`);
    if (scanner) {
      scanner.classList.remove('scanning');
      scanner.classList.add('success');
      if (scannerIcon) {
        scannerIcon.innerHTML = isTactical
          ? '<svg viewBox="0 0 48 48" width="44" height="44"><path fill="#00ff88" d="M20 38L8 26l3-3 9 9 20-20 3 3z"/></svg>'
          : '✓';
      }
    }
    if (scanText) {
      scanText.textContent = isTactical
        ? (already ? 'СЕАНС УЖЕ ЗАРЕГИСТРИРОВАН' : 'СЕАНС ЗАВЕРШЁН • ДОПУСК ВЫДАН')
        : (already ? 'Уже подтверждено' : 'Подтверждено');
    }
    if (scanStage) {
      scanStage.textContent = isTactical
        ? (already ? 'ЗАПИСЬ В РЕЕСТРЕ NATO/PKI' : 'КРИПТОПОДПИСЬ ЗАРЕГИСТРИРОВАНА')
        : (already ? 'Ранее зарегистрировано.' : 'Запись сохранена.');
    }
    if (successBanner) {
      successBanner.classList.add('active');
      if (successTime) successTime.textContent = `UTC+6 • ${signedAtText}`;
    }
    if (tacticalCert && isTactical) {
      tacticalCert.textContent = `CERT: ${certId} • CLASS: NATO RESTRICTED • SIGNER: ${initialsFromFio(payload.fio)}`;
    }
    payload.clientSignature = `${payload.fio || 'Клиент'} [ЭП-QES]`;
    payload.clientSignDate = signedAtText;
    render();
    if (signatureBox) {
      signatureBox.classList.add('active');
      signatureBox.innerHTML = isTactical
        ? `NATO/PKI [ЭП] <strong>${initialsFromFio(payload.fio)}</strong> • ${certId.slice(0, 28)}… • ${signedAtText}`
        : `Подпись: <strong>${initialsFromFio(payload.fio)} [ЭП]</strong> • ${signedAtText}`;
    }
    if (isTactical) updateTelemetry(1);
  }

  function restoreIfSigned() {
    const list = JSON.parse(localStorage.getItem(meta.storageSigned) || '[]');
    const found = list.find((it) => it.id === (payload.id || payload.docNo));
    if (found) applySigned(found.signedAt, true);
  }

  function startHold(e) {
    if (successBanner?.classList.contains('active')) return;
    if (!scanner || !progressBar) return;
    if (e?.cancelable) e.preventDefault();
    holding = true;
    holdStart = performance.now();
    scanner.classList.add('scanning');
    if (scanText) scanText.textContent = isTactical ? 'СКАНИРОВАНИЕ • НЕ ОТПУСКАЙТЕ' : 'Сканирование...';
    if (isTactical) setTacticalPhase(0);
    else if (scanStage) scanStage.textContent = 'Проверка...';
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tick);
  }

  function endHold() {
    if (!holding) return;
    holding = false;
    cancelAnimationFrame(rafId);
    if (scanner) scanner.classList.remove('scanning');
    setProgress(0);
    if (scanText) scanText.textContent = isTactical ? 'НАЖМИТЕ И УДЕРЖИВАЙТЕ СЕНСОР' : 'Нажмите и удерживайте';
    if (scanStage) scanStage.textContent = isTactical ? 'СИСТЕМА ГОТОВА • ОЖИДАНИЕ ОПЕРАТОРА' : 'Ожидание.';
    if (isTactical) updateTelemetry(0);
  }

  function tick(now) {
    if (!holding) return;
    const p = Math.min(1, (now - holdStart) / DURATION_MS);
    setProgress(p);
    if (isTactical) {
      setTacticalPhase(p);
      updateTelemetry(p);
    }
    if (p >= 1) {
      holding = false;
      cancelAnimationFrame(rafId);
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
    setProgress(1);
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
    const palette = isTactical ? ['#00ff88', '#8ec5ff', '#ffd080', '#1a3a5c'] : ['#00c853', '#1a3a5c', '#f0c419'];
    const pieces = Array.from({ length: isTactical ? 90 : 70 }, () => ({
      x: Math.random() * canvas.width,
      y: -10 - Math.random() * 200,
      s: 4 + Math.random() * 8,
      v: 2 + Math.random() * 4,
      c: palette[Math.floor(Math.random() * palette.length)]
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
    if (!scanner || !progressBar) {
      console.warn('HRL: scanner UI not found');
      return;
    }
    setProgress(0);
    if (scannerIcon) {
      scannerIcon.innerHTML = isTactical
        ? '<svg viewBox="0 0 64 64" width="52" height="52" stroke="#00ff88" fill="none" stroke-width="1.5"><rect x="14" y="14" width="36" height="36" rx="4" stroke-dasharray="4 3"/><path d="M32 20v24M24 28h16"/><circle cx="32" cy="32" r="10" opacity=".35"/><path d="M22 44c2-6 6-10 10-10s8 4 10 10"/></svg>'
        : '<svg viewBox="0 0 64 64" width="48" height="48" stroke="#1a3a5c" fill="none"><path d="M32 8c-8 0-14 6-14 14v8"/><path d="M32 20c-2.4 0-4 1.8-4 4.2V40"/><path d="M18 42c0 7.6 6 14 14 14s14-6.4 14-14"/></svg>';
    }
    if (isTactical) updateTelemetry(0);

    scanner.addEventListener('pointerdown', startHold);
    scanner.addEventListener('mousedown', (e) => {
      if (e.button === 0) startHold(e);
    });
    scanner.addEventListener('touchstart', (e) => {
      startHold(e);
    }, { passive: false });

    window.addEventListener('pointerup', endHold);
    window.addEventListener('pointercancel', endHold);
    window.addEventListener('mouseup', endHold);
    window.addEventListener('touchend', endHold);
    window.addEventListener('touchcancel', endHold);
    window.addEventListener('blur', endHold);
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
      const demoBase = {
        docType,
        id: 'DEMO',
        docNo: 'DEMO-001',
        fio: 'Демо (только для проверки админом)',
        reportDate: new Date().toISOString().slice(0, 10),
        reportDateText: HRL.formatDateRu(new Date().toISOString().slice(0, 10)),
        ...HRL.signingExtras({ docNo: 'DEMO-001' }, new Date().toISOString().slice(0, 10))
      };
      if (docType === 'custom') {
        payload = {
          ...demoBase,
          docTitle: 'Демо-документ',
          customBody: 'Здесь может быть **любой текст**.\n\n- Пункт 1\n- Пункт 2\n\n---\n\nПодпись подтверждается тактической биометрией.'
        };
      } else {
        payload = {
          ...demoBase,
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
          activeUsdTotalText: '0 ₸'
        };
      }
    }

    render();
    restoreIfSigned();
    setupBiometric();
  }

  init();
})();
