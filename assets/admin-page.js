(function () {
  const docType = document.body.dataset.docType;
  const meta = window.HRL_META[docType];
  const template = window.HRL_TEMPLATES[docType];
  if (!meta || !template) return;

  const formStatus = document.getElementById('formStatus');
  const listStatus = document.getElementById('listStatus');
  const previewEl = document.getElementById('preview');
  const shortBox = document.getElementById('shortBox');
  const shortUrl = document.getElementById('shortUrl');
  const longUrl = document.getElementById('longUrl');
  const shortHint = document.getElementById('shortHint');

  function val(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  /** Суммы без ограничения — text-поля, пробелы и запятые допускаются */
  function num(id) {
    const el = document.getElementById(id);
    if (!el) return NaN;
    let raw = String(el.value).trim().replace(/\s/g, '');
    if (!raw) return NaN;
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw) || /^\d{1,3}(,\d{3})+(\.\d+)?$/.test(raw)) {
      raw = raw.replace(/\./g, '').replace(',', '.');
    } else {
      raw = raw.replace(',', '.');
    }
    const n = Number(raw);
    return Number.isFinite(n) ? n : NaN;
  }

  function hasAmount(n) {
    return Number.isFinite(n) && n > 0;
  }

  function collectData() {
    const reportDate = val('reportDate') || new Date().toISOString().slice(0, 10);
    const base = {
      docType,
      id: '',
      fio: val('fio'),
      reportDate,
      reportDateText: HRL.formatDateRu(reportDate),
      tpl: template,
      ...HRL.signingExtras({ docNo: val('docNo') || val('id') }, reportDate)
    };

    if (docType === 'report') {
      const investKzt = num('investKzt');
      const cryptoKzt = num('cryptoKzt');
      const euroKzt = num('euroKzt');
      const blockedKzt = num('blockedKzt');
      const activeUsdTotal = num('activeUsdTotal');
      return {
        ...base,
        id: val('docNo'),
        docNo: val('docNo'),
        investKzt: String(investKzt),
        cryptoKzt: String(cryptoKzt),
        euroKzt: String(euroKzt),
        blockedKzt: String(blockedKzt),
        activeUsdTotal: String(activeUsdTotal),
        investUsdText: HRL.formatMoney(investKzt, 'KZT'),
        cryptoUsdText: HRL.formatMoney(cryptoKzt, 'KZT'),
        euroUsdText: HRL.formatMoney(euroKzt, 'KZT'),
        blockedKztText: HRL.formatMoney(blockedKzt, 'KZT'),
        activeUsdTotalText: HRL.formatMoney(activeUsdTotal, 'KZT'),
        label: `Отчёт № ${val('docNo')}`
      };
    }

    if (docType === 'claim') {
      const claimAmount = num('claimAmount');
      return {
        ...base,
        id: `claim-${val('fio').replace(/\s+/g, '-').slice(0, 24)}-${reportDate}`,
        courtName: val('courtName'),
        plaintiffName: val('plaintiffName'),
        plaintiffAddress: val('plaintiffAddress'),
        plaintiffPhone: val('plaintiffPhone'),
        defendantName: val('defendantName'),
        birthYear: val('birthYear'),
        claimAmountText: val('claimAmountText') || HRL.formatMoney(claimAmount, 'KZT'),
        label: `Иск — ${HRLSecure.maskName(val('fio'))}`
      };
    }

    if (docType === 'custom') {
      const docTitle = val('docTitle') || 'Документ';
      return {
        ...base,
        id: val('docNo'),
        docNo: val('docNo'),
        docTitle,
        customBody: val('customBody'),
        label: `${docTitle} № ${val('docNo')}`
      };
    }

    const blockedKzt = num('blockedKzt');
    return {
      ...base,
      id: val('docNo'),
      docNo: val('docNo'),
      blockedKzt: String(blockedKzt),
      blockedKztText: HRL.formatMoney(blockedKzt, 'KZT'),
      label: `Договор № ${val('docNo')}`
    };
  }

  function validate(data) {
    if (!data.fio) return 'Укажите ФИО.';
    if (docType === 'report') {
      if (!data.docNo || !data.reportDate) return 'Заполните номер документа и дату.';
      const blocked = num('blockedKzt');
      const active = num('activeUsdTotal');
      if (!hasAmount(blocked) || !hasAmount(active)) {
        return 'Укажите заблокированные и активные средства (любая сумма, без ограничения).';
      }
      return '';
    }
    if (docType === 'claim') {
      if (!data.courtName || !data.plaintiffName) return 'Укажите суд и истца.';
      if (!data.claimAmountText) return 'Укажите сумму иска.';
      if (!data.birthYear) return 'Укажите год рождения.';
      return '';
    }
    if (docType === 'custom') {
      if (!data.docNo || !data.reportDate) return 'Заполните номер и дату.';
      if (!data.docTitle) return 'Укажите заголовок.';
      if (!data.customBody) return 'Введите текст.';
      return '';
    }
    if (!data.docNo || !data.reportDate) return 'Заполните номер договора и дату.';
    if (!hasAmount(num('blockedKzt'))) return 'Укажите сумму ущерба.';
    return '';
  }

  function renderPreview() {
    const data = collectData();
    const text = HRL.applyTemplate(template, data);
    previewEl.innerHTML = HRL.markdownToHtml(text);
  }

  function ensureRepoMeta() {
    const pub = HRL.getPublicRepoConfig();
    const s = HRL.loadGithubSettings();
    HRL.saveGithubSettings({
      owner: s.owner || pub.owner,
      repo: s.repo || pub.repo,
      branch: s.branch || pub.branch,
      path: s.path || meta.ghPathDefault
    });
  }

  function registerCreated(data, links) {
    const shortLink =
      typeof links === 'string' ? links : String(links?.short || '').trim();
    const longLink =
      typeof links === 'string'
        ? links
        : String(links?.long || links?.short || '').trim();
    const list = JSON.parse(localStorage.getItem(meta.storageCreated) || '[]');
    const idx = list.findIndex((x) => x.id === data.id);
    const row = {
      id: data.id,
      label: data.label,
      fioMasked: HRLSecure.maskName(data.fio),
      createdAt: new Date().toISOString(),
      shortLink,
      longLink,
      status: 'not_signed',
      signedAt: ''
    };
    if (idx >= 0) list[idx] = { ...list[idx], ...row };
    else list.push(row);
    localStorage.setItem(meta.storageCreated, JSON.stringify(list));
    renderTable();
  }

  function renderTable() {
    const list = JSON.parse(localStorage.getItem(meta.storageCreated) || '[]');
    const body = document.getElementById('registryBody');
    const empty = document.getElementById('emptyMsg');
    const table = document.getElementById('registryTable');
    document.getElementById('totalCount').textContent = String(list.length);
    if (!list.length) {
      empty.style.display = 'block';
      table.style.display = 'none';
      return;
    }
    empty.style.display = 'none';
    table.style.display = 'table';
    body.innerHTML = list.slice().reverse().map((item, i) => {
      const short = item.shortLink || '';
      const long = item.longLink || item.shortLink || '';
      const copyBtns = [
        short
          ? `<button type="button" class="btn alt btn-row" data-copy="${HRL.escapeHtml(short)}">Короткая</button>`
          : '',
        long
          ? `<button type="button" class="btn alt btn-row" data-copy="${HRL.escapeHtml(long)}">Полная</button>`
          : ''
      ]
        .filter(Boolean)
        .join(' ');
      const copyCell = copyBtns || '—';
      return `
      <tr>
        <td>${i + 1}</td>
        <td>${HRL.escapeHtml(item.label || item.id)}</td>
        <td>${HRL.escapeHtml(item.fioMasked || HRLSecure.maskName(item.fio || ''))}</td>
        <td>${item.createdAt ? new Date(item.createdAt).toLocaleString('ru-RU') : ''}</td>
        <td>${item.signedAt ? new Date(item.signedAt).toLocaleString('ru-RU') : '—'}</td>
        <td>${item.status === 'signed' ? 'Подписан' : 'Не подписан'}</td>
        <td>${copyCell}</td>
      </tr>`;
    }).join('');
  }

  async function syncSigned(silent) {
    const settings = HRL.getGithubSettings(meta.ghPathDefault);
    const ref = HRL.getRepoRef(settings || HRL.getPublicRepoConfig(), meta.ghPathDefault);
    if (!ref.owner || !ref.repo) {
      if (!silent) HRL.setStatus(listStatus, 'Репозиторий не настроен.', 'warn');
      return;
    }
    if (!silent) HRL.setStatus(listStatus, 'Загрузка подписей...', 'warn');

    try {
      const withToken = settings?.token ? settings : null;
      let remote = withToken ? await HRL.fetchSignedFromGithub(withToken) : null;
      if (!remote) remote = await HRL.fetchSignedPublic(ref);
      if (!remote) {
        if (!silent) HRL.setStatus(listStatus, 'Подписей пока нет или файл пуст.', 'warn');
        return;
      }
      const created = JSON.parse(localStorage.getItem(meta.storageCreated) || '[]');
      const signedIds = new Set(remote.map((r) => r.id));
      const updated = created.map((c) => {
        if (signedIds.has(c.id)) {
          const s = remote.find((r) => r.id === c.id);
          return { ...c, status: 'signed', signedAt: s?.signedAt || c.signedAt };
        }
        return c;
      });
      localStorage.setItem(meta.storageCreated, JSON.stringify(updated));
      localStorage.setItem(meta.storageSigned, JSON.stringify(remote));
      const n = updated.filter((c) => c.status === 'signed').length;
      if (!silent) {
        HRL.setStatus(listStatus, `Синхронизировано. Подписано: ${n} из ${created.length}.`, 'ok');
      }
      renderTable();
    } catch (err) {
      if (!silent) HRL.setStatus(listStatus, 'Ошибка синхронизации.', 'err');
    }
  }

  async function generateLink() {
    const data = collectData();
    const err = validate(data);
    if (err) {
      HRL.setStatus(formStatus, err, 'err');
      return;
    }
    HRL.setStatus(formStatus, 'Готовим ссылку на подпись...', 'warn');
    await HRL.sleep(150);

    const settings = HRL.getGithubSettings(meta.ghPathDefault);
    const id = HRL.makeSignId(docType);
    const payload = { ...data, docType, id };
    const longLink = HRL.buildSignLink(docType, payload);
    let shortLink = '';

    if (settings?.token) {
      try {
        await HRL.savePendingDoc(settings, id, payload);
        shortLink = HRL.buildSignLinkById(docType, id);
      } catch (e) {
        HRL.setStatus(
          formStatus,
          'Короткая ссылка недоступна — проверьте ключ в setup.html. Полная ссылка готова ниже.',
          'warn'
        );
      }
    }

    if (longUrl) longUrl.textContent = longLink;
    if (shortUrl) {
      shortUrl.textContent = shortLink || '— настройте ключ GitHub (setup.html)';
    }
    if (shortHint) {
      shortHint.textContent = shortLink
        ? 'Ссылка с ?id=… на GitHub Pages — удобна в WhatsApp.'
        : 'Нужен служебный ключ GitHub — см. setup.html. Пока отправляйте полную ссылку.';
    }
    if (shortBox) shortBox.classList.add('active');

    registerCreated(data, { short: shortLink, long: longLink });

    const copyDefault = shortLink || longLink;
    try {
      await navigator.clipboard.writeText(copyDefault);
      HRL.setStatus(
        formStatus,
        shortLink
          ? 'Короткая ссылка скопирована. Полная — кнопкой ниже.'
          : 'Полная ссылка скопирована. Настройте ключ для короткой.',
        'ok'
      );
    } catch (e) {
      HRL.setStatus(formStatus, 'Ссылки готовы — скопируйте кнопкой ниже.', 'ok');
    }
    renderPreview();
  }

  document.getElementById('previewBtn')?.addEventListener('click', renderPreview);
  document.getElementById('generateBtn')?.addEventListener('click', generateLink);
  document.getElementById('syncBtn')?.addEventListener('click', syncSigned);
  async function copyFromEl(el, okMsg) {
    const text = el?.textContent.trim() || '';
    if (!text || text.startsWith('—')) {
      HRL.setStatus(formStatus, 'Сначала создайте ссылку.', 'err');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      HRL.setStatus(formStatus, okMsg, 'ok');
    } catch (e) {
      HRL.setStatus(formStatus, 'Не удалось скопировать.', 'err');
    }
  }

  document.getElementById('copyShortBtn')?.addEventListener('click', () => {
    copyFromEl(shortUrl, 'Короткая ссылка скопирована.');
  });
  document.getElementById('copyLongBtn')?.addEventListener('click', () => {
    copyFromEl(longUrl, 'Полная ссылка скопирована.');
  });
  document.getElementById('registryBody')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-copy]');
    if (!btn) return;
    try {
      await navigator.clipboard.writeText(btn.getAttribute('data-copy'));
      HRL.setStatus(formStatus, 'Ссылка скопирована.', 'ok');
    } catch (err) {
      HRL.setStatus(formStatus, 'Ошибка копирования.', 'err');
    }
  });
  document.querySelectorAll('input, textarea, select').forEach((el) => {
    el.addEventListener('input', renderPreview);
    el.addEventListener('change', renderPreview);
  });

  const rd = document.getElementById('reportDate');
  if (rd && !rd.value) rd.valueAsDate = new Date();

  ensureRepoMeta();
  renderPreview();
  renderTable();
  syncSigned(true);
})();
