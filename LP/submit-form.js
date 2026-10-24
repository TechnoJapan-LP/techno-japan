(() => {
  const form = document.getElementById('apply-form');
  if (!form) return;

  const isEnglish = document.documentElement.lang === 'en';
  const copy = isEnglish ? {
    required: {
      1: 'Enter the festival name.', 2: 'Choose a start date.', 3: 'Check the end date.', 4: 'Enter the venue name.',
      5: 'Choose a prefecture.', 6: 'Check the venue address.', 7: 'Check the official website URL.', 8: 'Check the official Instagram.',
      9: 'Check the ticket URL.', 10: 'Choose at least one genre.', 11: 'Check the Japanese description.', 12: 'Check the English description.',
      13: 'Check the lineup.', 14: 'Check the materials URL.', 15: 'Check the remarks.', 16: 'Permission is required.'
    },
    invalidDate: 'The end date must be on or after the start date.',
    sending: 'Sending…',
    received: 'Received',
    error: 'Please check this field.'
  } : {
    required: {
      1: 'フェスティバル名を入力してください。', 2: '開催日を入力してください。', 3: '終了日を確認してください。', 4: '会場名を入力してください。',
      5: '都道府県を選択してください。', 6: '会場住所を確認してください。', 7: 'URLを確認してください。', 8: '公式Instagramを確認してください。',
      9: 'URLを確認してください。', 10: 'ジャンルを1つ以上選択してください。', 11: '紹介文を確認してください。', 12: '紹介文を確認してください。',
      13: 'ラインナップを確認してください。', 14: '資料URLを確認してください。', 15: '備考を確認してください。', 16: '掲載許諾が必要です。'
    },
    invalidDate: '終了日は開催日以降の日付にしてください。',
    sending: '送信中…',
    received: 'Received',
    error: 'この項目を確認してください。'
  };

  const fields = [...form.querySelectorAll('[data-question]')];
  const fieldFor = question => fields.find(field => field.dataset.question === String(question));
  const controlsFor = field => [...field.querySelectorAll('input, textarea, select')];
  const showError = (question, message) => {
    const field = fieldFor(question);
    if (!field) return;
    field.classList.add('apply-invalid');
    controlsFor(field).forEach(control => control.setAttribute('aria-invalid', 'true'));
    const error = field.querySelector('.apply-error');
    if (error) { error.textContent = message || copy.required[question] || copy.error; error.hidden = false; }
  };
  const clearErrors = () => fields.forEach(field => {
    field.classList.remove('apply-invalid');
    controlsFor(field).forEach(control => control.removeAttribute('aria-invalid'));
    const error = field.querySelector('.apply-error');
    if (error) error.hidden = true;
  });

  const groups = [...form.querySelectorAll('[data-checkbox-group]')];
  const syncGroupRequired = group => {
    const boxes = [...group.querySelectorAll('input[type="checkbox"]')];
    const hasSelection = boxes.some(box => box.checked);
    if (boxes[0]) boxes[0].required = !hasSelection;
  };
  groups.forEach(group => {
    syncGroupRequired(group);
    group.addEventListener('change', () => syncGroupRequired(group));
  });
  form.querySelectorAll('[data-require-change="true"]').forEach(select => {
    select.addEventListener('change', () => { select.dataset.changed = 'true'; });
  });

  form.addEventListener('invalid', event => {
    const field = event.target.closest('[data-question]');
    if (!field) return;
    showError(field.dataset.question);
  }, true);

  const receive = () => {
    form.hidden = true;
    document.getElementById('apply-error').hidden = true;
    const received = document.getElementById('apply-received');
    received.hidden = false;
    received.scrollIntoView({ block: 'nearest' });
  };

  const validate = () => {
    let valid = true;
    fields.forEach(field => {
      const question = field.dataset.question;
      const group = field.querySelector('[data-checkbox-group]') || field;
      const boxes = [...group.querySelectorAll('input[type="checkbox"]')];
      if (boxes.length) {
        if (field.dataset.required === 'true' && !boxes.some(box => box.checked)) { showError(question); valid = false; }
        return;
      }
      const control = controlsFor(field)[0];
      if (control?.dataset.requireChange === 'true' && control.dataset.changed !== 'true') { showError(question); valid = false; return; }
      if (control && control.required && !control.value.trim()) { showError(question); valid = false; }
    });
    const start = form.elements.namedItem('entry.1641677491')?.value;
    const end = form.elements.namedItem('entry.1594578578')?.value;
    if (start && end && end < start) { showError(3, copy.invalidDate); valid = false; }
    return valid;
  };

  form.addEventListener('submit', async event => {
    event.preventDefault();
    clearErrors();
    if (!validate()) {
      const first = form.querySelector('.apply-invalid input, .apply-invalid textarea, .apply-invalid select');
      first?.focus();
      return;
    }

    if (form.elements.namedItem('website')?.value.trim()) { receive(); return; }

    const submit = document.getElementById('apply-submit');
    submit.disabled = true;
    submit.textContent = copy.sending;
    const body = new URLSearchParams();
    body.set('fvv', '1');
    body.set('pageHistory', '0');
    form.querySelectorAll('[name^="entry."]').forEach(control => {
      if (control.type === 'checkbox') { if (control.checked) body.append(control.name, control.value); return; }
      if (control.type === 'date') {
        if (!control.value) return;
        const [year, month, day] = control.value.split('-');
        body.set(`${control.name}_year`, year);
        body.set(`${control.name}_month`, String(Number(month)));
        body.set(`${control.name}_day`, String(Number(day)));
        return;
      }
      if (control.value) body.set(control.name, control.value);
    });

    try {
      await fetch('https://docs.google.com/forms/d/e/1FAIpQLSfh7ahIgtN5zflxeSbKBGLqTB07SS1DbCFpm0SrCU-5-PLDvg/formResponse', {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
      });
      receive();
    } catch {
      document.getElementById('apply-error').hidden = false;
      submit.disabled = false;
      submit.textContent = isEnglish ? 'Apply' : '申請する';
    }
  });
})();
