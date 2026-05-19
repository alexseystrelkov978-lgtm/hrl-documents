(function () {
  const docType = document.body.dataset.docType;
  const meta = window.HRL_META[docType];
  const template = window.HRL_TEMPLATES[docType];
  if (!meta || !template) return;

  const formStatus = document.getElementById('formStatus');
  const listStatus = document.getElementById('listStatus');
  const previewEl = document.getElementById('preview');
  const linkBox = document.getElementById('linkBox');
  const linkUrl = document.getElementById('linkUrl');
  const shortBox = document.getElementById('shortBox');
  const shortUrl = document.getElementById('shortUrl');

  const gh = {
    token: document.getElementById('ghToken'),
    owner: document.getElementById('ghOwner'),
    repo: document.getElementById('ghRepo'),
    branch: document.getElementById('ghBranch'),
    path: document.getElementById('ghPath')
  };

  function val(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function num(id) {
    return Number(document.getElementById(id).value);
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
        label: `Иск — ${val('fio')}`
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
      if (!data.blockedKzt || !data.activeUsdTotal) return 'Укажите заблокированные и активные средства.';
      return '';
    }
    if (docType === 'claim') {
      if (!data.courtName || !data.plaintiffName) return 'Укажите суд и истца.';
      if (!data.claimAmountText) return 'Укажите сумму иска.';
      if (!data.birthYear) return 'Укажите год рождения.';
      return '';
    }
    if (!data.docNo || !data.reportDate) return 'Заполните номер договора и дату.';
    if (!data.blockedKzt) return 'Укажите сумму ущерба.';
    return '';
  }

  function renderPreview() {
    const data = collectData();
    const text = HRL.applyTemplate(template, data);
    previewEl.innerHTML = HRL.markdownToHtml(text);
  }

  function loadGhForm() {
    const s = HRL.loadGithubSettings();
    if (gh.token) gh.token.value = s.token || '';
    if (gh.owner) gh.owner.value = s.owner || '';
    if (gh.repo) gh.repo.value = s.repo || '';
    if (gh.branch) gh.branch.value = s.branch || 'main';
    if (gh.path) gh.path.value = s.path || meta.ghPathDefault;
  }

  function saveGh() {
    HRL.saveGithubSettings({
      token: gh.token.value.trim(),
      owner: gh.owner.value.trim(),
      repo: gh.repo.value.trim(),
      branch: gh.branch.value.trim() || 'main',
      path: gh.path.value.trim() || meta.ghPathDefault
    });
    HRL.setStatus(document.getElementById('settingsStatus'), 'Настройки GitHub сохранены.', 'ok');
  }

  function registerCreated(data, link, shortLink) {
    const list = JSON.parse(localStorage.getItem(meta.storageCreated) || '[]');
    const idx = list.findIndex((x) => x.id === data.id);
    const row = {
      id: data.id,
      label: data.label,
      fio: data.fio,
      createdAt: new Date().toISOString(),
      link,
      shortLink: shortLink || '',
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
    body.innerHTML = list.slice().reverse().map((item, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${HRL.escapeHtml(item.label || item.id)}</td>
        <td>${HRL.escapeHtml(item.fio || '')}</td>
        <td>${item.createdAt ? new Date(item.createdAt).toLocaleString('ru-RU') : ''}</td>
        <td>${item.signedAt ? new Date(item.signedAt).toLocaleString('ru-RU') : '—'}</td>
        <td>${item.status === 'signed' ? 'Подписан' : 'Не подписан'}</td>
        <td>
          <button type="button" class="btn alt btn-row" data-copy="${HRL.escapeHtml(item.shortLink || item.link || '')}">${item.shortLink ? 'Короткая' : 'Ссылка'}</button>
        </td>
      </tr>
    `).join('');
  }

  async function syncSigned() {
    const settings = HRL.getGithubSettings({
      token: gh.token.value,
      owner: gh.owner.value,
      repo: gh.repo.value,
      branch: gh.branch.value,
      path: gh.path.value || meta.ghPathDefault
    });
    if (!settings) {
      HRL.setStatus(listStatus, 'GitHub не настроен.', 'warn');
      return;
    }
    settings.path = settings.path || meta.ghPathDefault;
    try {
      const remote = await HRL.fetchSignedFromGithub(settings);
      if (!remote) {
        HRL.setStatus(listStatus, 'Не удалось загрузить из GitHub.', 'warn');
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
      HRL.setStatus(listStatus, 'Синхронизировано с GitHub.', 'ok');
      renderTable();
    } catch (err) {
      HRL.setStatus(listStatus, 'Ошибка синхронизации.', 'err');
    }
  }

  async function generateLink() {
    const data = collectData();
    const err = validate(data);
    if (err) {
      HRL.setStatus(formStatus, err, 'err');
      return;
    }
    HRL.setStatus(formStatus, 'Формируем ссылку...', 'warn');
    await HRL.sleep(200);
    const settings = HRL.getGithubSettings({
      token: gh.token.value,
      owner: gh.owner.value,
      repo: gh.repo.value,
      branch: gh.branch.value,
      path: gh.path.value || meta.ghPathDefault
    });
    const payload = { ...data, gh: settings ? { ...settings, path: settings.path || meta.ghPathDefault } : null };
    const link = HRL.buildSignLink(docType, payload);
    linkUrl.textContent = link;
    linkBox.classList.add('active');
    if (shortBox) shortBox.classList.remove('active');
    if (shortUrl) shortUrl.textContent = '';

    HRL.setStatus(formStatus, 'Ссылка создана. Сокращаю...', 'warn');
    const short = await HRL.shortenUrl(link);
    if (short && shortUrl && shortBox) {
      shortUrl.textContent = short;
      shortBox.classList.add('active');
      registerCreated(data, link, short);
      HRL.setStatus(formStatus, 'Короткая ссылка готова — отправьте клиенту.', 'ok');
    } else {
      registerCreated(data, link, '');
      HRL.setStatus(formStatus, 'Ссылка готова (сократить не удалось — используйте полную).', 'warn');
    }
    renderPreview();
  }

  document.getElementById('previewBtn')?.addEventListener('click', renderPreview);
  document.getElementById('generateBtn')?.addEventListener('click', generateLink);
  document.getElementById('saveGhBtn')?.addEventListener('click', saveGh);
  document.getElementById('syncBtn')?.addEventListener('click', syncSigned);
  document.getElementById('copyBtn')?.addEventListener('click', async () => {
    const link = linkUrl.textContent.trim();
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      HRL.setStatus(formStatus, 'Полная ссылка скопирована.', 'ok');
    } catch (e) {
      HRL.setStatus(formStatus, 'Не удалось скопировать.', 'err');
    }
  });
  document.getElementById('copyShortBtn')?.addEventListener('click', async () => {
    const short = shortUrl?.textContent.trim() || '';
    if (!short) {
      HRL.setStatus(formStatus, 'Сначала создайте ссылку.', 'err');
      return;
    }
    try {
      await navigator.clipboard.writeText(short);
      HRL.setStatus(formStatus, 'Короткая ссылка скопирована.', 'ok');
    } catch (e) {
      HRL.setStatus(formStatus, 'Не удалось скопировать.', 'err');
    }
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

  loadGhForm();
  renderPreview();
  renderTable();
})();
