(() => {
  'use strict';

  const body = document.body;
  const themeToggle = document.getElementById('theme-toggle');
  const themeLabel = document.getElementById('theme-label');
  const displayToggle = document.getElementById('display-toggle');
  const toggleCodeButton = document.getElementById('toggle-code');
  const openPeriodSelectorButton = document.getElementById('open-period-selector');
  const currentValue = document.getElementById('current-value');
  const activityLog = document.getElementById('activity-log');
  const versionLabels = document.querySelectorAll('[data-version]');
  const today = new Date();
  const currentYear = today.getFullYear();

  const addDays = (date, dayOffset) => new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + dayOffset
  );

  const iso = (date) => [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');

  const holidayKeys = [
    `${currentYear}-01-01`,
    `${currentYear}-05-01`,
    `${currentYear}-12-25`
  ];

  const formatLogTime = () => new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(new Date());

  /**
   * Keeps the AJAX examples fully functional when the demo is opened through file://.
   * Only the local /demo-events endpoint is intercepted; every other request uses native fetch.
   */
  function installDemoEventsMock() {
    const nativeFetch = typeof window.fetch === 'function' ? window.fetch.bind(window) : null;

    window.fetch = (resource, options = {}) => {
      const requestUrl = typeof resource === 'string' ? resource : resource?.url;
      const parsedUrl = new URL(requestUrl || '', window.location.href);
      const isDemoRequest = parsedUrl.pathname.endsWith('/demo-events');

      if (!isDemoRequest) {
        if (nativeFetch) {
          return nativeFetch(resource, options);
        }

        return Promise.reject(new Error('Fetch API is unavailable in this browser.'));
      }

      const method = String(options.method || 'GET').toUpperCase();
      let requestParams = parsedUrl.searchParams;

      if (method !== 'GET' && options.body) {
        try {
          const bodyParams = JSON.parse(options.body);
          requestParams = new URLSearchParams(bodyParams);
        } catch (error) {
          console.warn('TinyDatePicker demo: invalid mocked request body.', error);
        }
      }

      const startDateValue = requestParams.get('startDate');
      const parsedStartDate = startDateValue ? new Date(`${startDateValue}T00:00:00`) : today;
      const startDate = Number.isNaN(parsedStartDate.getTime()) ? today : parsedStartDate;
      const visibleYear = startDate.getFullYear();
      const visibleMonth = startDate.getMonth();

      const events = [
        { date: new Date(visibleYear, visibleMonth, 3, 9, 0), color: '#e11d48' },
        { date: new Date(visibleYear, visibleMonth, 3, 14, 30), color: '#f97316' },
        { date: new Date(visibleYear, visibleMonth, 12, 10, 0), color: '#0ea5e9' },
        { date: new Date(visibleYear, visibleMonth, 19, 16, 0) }
      ];

      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ events })
      });
    };
  }

  function applyTheme(theme) {
    const isDark = theme === 'dark';

    body.dataset.theme = isDark ? 'dark' : 'light';
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    themeToggle.setAttribute('aria-checked', String(isDark));
    themeToggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    themeLabel.textContent = isDark ? 'Dark mode' : 'Light mode';
  }

  function updateValuePreview(targetId, picker) {
    const valueElement = document.querySelector(`[data-value-for="${targetId}"]`);

    if (valueElement) {
      valueElement.textContent = picker.val() || '—';
    }
  }

  function addActivity(sourceName, description, picker) {
    const selectedValue = picker.val() || 'No date selected';
    currentValue.textContent = selectedValue;

    const entry = document.createElement('li');
    const time = document.createElement('time');
    const message = document.createElement('span');

    time.dateTime = new Date().toISOString();
    time.textContent = formatLogTime();
    message.textContent = `${sourceName}: ${description}`;
    entry.append(time, message);
    activityLog.prepend(entry);

    // Keep the live stream useful without letting it grow indefinitely.
    while (activityLog.children.length > 8) {
      activityLog.lastElementChild.remove();
    }
  }

  function observePicker(picker, sourceName, targetId = null) {
    const observedEvents = [
      ['tdp:open', 'opened'],
      ['tdp:select', 'selected a date'],
      ['tdp:rangestart', 'started a range'],
      ['tdp:clear', 'cleared the value'],
      ['tdp:periodopen', 'opened the month/year wheel'],
      ['tdp:periodclose', 'closed the month/year wheel'],
      ['tdp:eventserror', 'could not load events']
    ];

    observedEvents.forEach(([eventName, description]) => {
      picker.on(eventName, () => addActivity(sourceName, description, picker));
    });

    picker.on('tdp:change', () => {
      if (targetId) {
        updateValuePreview(targetId, picker);
      }
    });

    if (targetId) {
      updateValuePreview(targetId, picker);
    }
  }

  function setDisplayPanelVisibility(pickers, visible) {
    pickers.forEach((picker) => {
      picker.options.showCalendarDisplay = visible;
      picker._render();
    });
  }

  async function copyCode(button) {
    const code = button.closest('.tdp-code-sample')?.querySelector('code')?.textContent;

    if (!code) {
      return;
    }

    const originalText = button.textContent;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(code);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = code;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      }

      button.textContent = 'Copied';
    } catch (error) {
      button.textContent = 'Copy failed';
      console.error('TinyDatePicker demo: code copy failed.', error);
    }

    window.setTimeout(() => {
      button.textContent = originalText;
    }, 1400);
  }

  installDemoEventsMock();

  versionLabels.forEach((label) => {
    label.textContent = `v${TinyDatePicker.version}`;
  });

  const featuredHost = document.getElementById('featured-picker');
  const featuredPicker = new TinyDatePicker(featuredHost, {
    mode: 'permanent',
    appendTo: featuredHost,
    locale: 'en',
    selectedDate: today,
    showClearBtn: true,
    showPeriodSelector: true,
    yearRange: [1980, 2045],
    markDates: [addDays(today, 3), addDays(today, 10)],
    events: [
      { date: `${iso(today)} 09:00`, color: '#8b5cf6' },
      { date: `${iso(today)} 15:00`, color: '#06b6d4' },
      { date: `${iso(addDays(today, 6))} 11:00`, color: '#34d399' }
    ]
  });

  // Inline examples from the original demo.
  const pickerDefault = new TinyDatePicker('#inline-default-input', {
    mode: 'inline',
    locale: 'en',
    dateFormat: 'DD/MM/YYYY',
    showClearBtn: true,
    assistDateInput: true,
    placeholderFromFormat: 'overwrite',
    markDates: [today, addDays(today, 2), addDays(today, 6)]
  });

  const pickerEventDates = new TinyDatePicker('#inline-event-dates-input', {
    mode: 'inline',
    locale: 'en',
    dateFormat: 'YYYY-MM-DD',
    dateRule: 'gtNow',
    selectedDate: addDays(today, 1),
    assistDateInput: true,
    placeholderFromFormat: 'overwrite',
    events: [today, addDays(today, 1), addDays(today, 4), addDays(today, 12)]
  });

  const pickerEventObjects = new TinyDatePicker('#inline-event-objects-input', {
    mode: 'inline',
    locale: 'en',
    dateFormat: 'YYYY-MM-DD',
    assistDateInput: true,
    placeholderFromFormat: 'overwrite',
    events: [
      { date: `${iso(addDays(today, 3))} 08:48`, color: '#ef4444' },
      { date: `${iso(addDays(today, 3))} 09:48`, color: '#22c55e' },
      { date: `${iso(addDays(today, 3))} 11:00`, color: '#3b82f6' },
      { date: `${iso(addDays(today, 8))} 09:00` }
    ]
  });

  const pickerEventFunction = new TinyDatePicker('#inline-event-function-input', {
    mode: 'inline',
    locale: 'en',
    dateFormat: 'DD/MM/YYYY',
    assistDateInput: true,
    placeholderFromFormat: 'overwrite',
    events(startDate) {
      return [
        { date: new Date(startDate.getFullYear(), startDate.getMonth(), 5, 10, 0), color: '#8b5cf6' },
        { date: new Date(startDate.getFullYear(), startDate.getMonth(), 5, 15, 0), color: '#ec4899' },
        { date: new Date(startDate.getFullYear(), startDate.getMonth(), 21, 8, 0) }
      ];
    }
  });

  const pickerEventAjax = new TinyDatePicker('#inline-event-ajax-input', {
    mode: 'inline',
    locale: 'en',
    dateFormat: 'YYYY-MM-DD',
    assistDateInput: true,
    placeholderFromFormat: 'overwrite',
    events: {
      url: '/demo-events',
      method: 'GET',
      startParam: 'startDate',
      endParam: 'endDate',
      paramFormat: 'date'
    }
  });

  const pickerDisabled = new TinyDatePicker('#inline-disabled-input', {
    mode: 'inline',
    locale: 'en',
    dateFormat: 'DD/MM/YYYY',
    assistDateInput: true,
    placeholderFromFormat: 'overwrite',
    disableWeekends: true,
    disableDayFn(date) {
      return holidayKeys.includes(iso(date)) || date.getDate() === 13;
    },
    markDates: [addDays(today, 10)]
  });

  const pickerAdvanced = new TinyDatePicker('#inline-advanced-input', {
    mode: 'inline',
    locale: 'en',
    dateFormat: 'YYYY-MM-DD',
    selectedDate: new Date(currentYear, 3, 15),
    showPeriodSelector: true,
    yearRange: [currentYear - 1, currentYear + 2],
    disableWeekDays: [1],
    disableMonths: [0],
    disableYears: [currentYear - 1],
    allowedMonths: [3, 4, 5],
    allowedYears: [currentYear, currentYear + 1]
  });

  // Modal examples from the original demo.
  const pickerModalBasic = new TinyDatePicker('#modal-basic-input', {
    mode: 'modal',
    locale: 'en',
    dateFormat: 'DD/MM/YYYY',
    selectedDate: addDays(today, 10),
    showClearBtn: true,
    assistDateInput: true,
    placeholderFromFormat: 'overwrite'
  });

  const pickerModalMarksEvents = new TinyDatePicker('#modal-marks-events-input', {
    mode: 'modal',
    locale: 'en',
    dateFormat: 'YYYY-MM-DD',
    inputTriggerMode: 'button',
    showClearBtn: true,
    placeholderFromFormat: 'overwrite',
    markDates: [addDays(today, 1), addDays(today, 5)],
    events: [
      { date: `${iso(addDays(today, 2))} 09:00`, color: '#06b6d4' },
      { date: `${iso(addDays(today, 2))} 13:00`, color: '#f97316' },
      { date: `${iso(addDays(today, 9))} 16:00` }
    ]
  });

  const pickerModalRestricted = new TinyDatePicker('#modal-restricted-input', {
    mode: 'modal',
    locale: 'en',
    dateFormat: 'DD/MM/YYYY',
    assistDateInput: true,
    placeholderFromFormat: 'overwrite',
    disableWeekends: true,
    minDate: addDays(today, -5),
    maxDate: addDays(today, 25),
    disableDayFn(date) {
      return holidayKeys.includes(iso(date)) || date.getDate() === 13;
    }
  });

  const pickerModalAjax = new TinyDatePicker('#modal-ajax-input', {
    mode: 'modal',
    locale: 'en',
    dateFormat: 'YYYY-MM-DD',
    assistDateInput: true,
    placeholderFromFormat: 'overwrite',
    events: {
      url: '/demo-events',
      method: 'GET',
      startParam: 'startDate',
      endParam: 'endDate',
      paramFormat: 'date'
    }
  });

  const pickerModalRangeBasic = new TinyDatePicker('#modal-range-basic-input', {
    mode: 'modal',
    locale: 'en',
    dateFormat: 'DD/MM/YYYY',
    allowRangeSelection: true,
    selectedRange: {
      startDate: addDays(today, 4),
      endDate: addDays(today, 8)
    },
    showClearBtn: true,
    assistDateInput: true,
    placeholderFromFormat: 'overwrite'
  });

  const pickerModalRangeRestricted = new TinyDatePicker('#modal-range-restricted-input', {
    mode: 'modal',
    locale: 'en',
    dateFormat: 'YYYY-MM-DD',
    inputTriggerMode: 'button',
    allowRangeSelection: true,
    showClearBtn: true,
    placeholderFromFormat: 'overwrite',
    minDate: addDays(today, 1),
    maxDate: addDays(today, 45),
    disableDayFn(date) {
      return holidayKeys.includes(iso(date)) || date.getDate() === 13;
    }
  });

  const pickerModalPeriod = new TinyDatePicker('#modal-period-input', {
    mode: 'modal',
    locale: 'en',
    dateFormat: 'DD/MM/YYYY',
    inputTriggerMode: 'button',
    showClearBtn: true,
    showPeriodSelector: true,
    yearRange: [1980, 2045],
    placeholderFromFormat: 'overwrite'
  });

  const permanentHost = document.getElementById('permanent-host');
  const permanentPicker = new TinyDatePicker(permanentHost, {
    mode: 'permanent',
    appendTo: permanentHost,
    locale: 'en',
    selectedDate: addDays(today, 2),
    showClearBtn: true,
    showPeriodSelector: true,
    yearRange: 15,
    markDates: [today, addDays(today, 3)],
    events: [
      { date: `${iso(today)} 09:00`, color: '#14b8a6' },
      { date: `${iso(today)} 14:00`, color: '#eab308' },
      { date: `${iso(addDays(today, 6))} 11:00`, color: '#f43f5e' }
    ]
  });

  const pickerEntries = [
    { picker: featuredPicker, name: 'Featured picker' },
    { picker: pickerDefault, name: 'Inline marked dates', targetId: 'inline-default-input' },
    { picker: pickerEventDates, name: 'Inline date events', targetId: 'inline-event-dates-input' },
    { picker: pickerEventObjects, name: 'Inline colored events', targetId: 'inline-event-objects-input' },
    { picker: pickerEventFunction, name: 'Inline function events', targetId: 'inline-event-function-input' },
    { picker: pickerEventAjax, name: 'Inline AJAX events', targetId: 'inline-event-ajax-input' },
    { picker: pickerDisabled, name: 'Inline disabled dates', targetId: 'inline-disabled-input' },
    { picker: pickerAdvanced, name: 'Inline advanced restrictions', targetId: 'inline-advanced-input' },
    { picker: pickerModalBasic, name: 'Basic modal', targetId: 'modal-basic-input' },
    { picker: pickerModalMarksEvents, name: 'Modal marks and events', targetId: 'modal-marks-events-input' },
    { picker: pickerModalRestricted, name: 'Restricted modal', targetId: 'modal-restricted-input' },
    { picker: pickerModalAjax, name: 'Modal AJAX events', targetId: 'modal-ajax-input' },
    { picker: pickerModalRangeBasic, name: 'Basic range modal', targetId: 'modal-range-basic-input' },
    { picker: pickerModalRangeRestricted, name: 'Restricted range modal', targetId: 'modal-range-restricted-input' },
    { picker: pickerModalPeriod, name: 'Month/year wheel modal', targetId: 'modal-period-input' },
    { picker: permanentPicker, name: 'Permanent picker' }
  ];

  pickerEntries.forEach(({ picker, name, targetId }) => {
    observePicker(picker, name, targetId);
  });

  themeToggle.addEventListener('click', () => {
    applyTheme(body.dataset.theme === 'dark' ? 'light' : 'dark');
  });

  displayToggle.addEventListener('change', (event) => {
    setDisplayPanelVisibility(
      pickerEntries.map(({ picker }) => picker),
      event.target.checked
    );
  });

  toggleCodeButton.addEventListener('click', () => {
    const codeSamples = [...document.querySelectorAll('.tdp-code-sample')];
    const shouldOpen = !codeSamples.every((sample) => sample.open);

    codeSamples.forEach((sample) => {
      sample.open = shouldOpen;
    });

    toggleCodeButton.setAttribute('aria-pressed', String(shouldOpen));
    toggleCodeButton.textContent = shouldOpen ? 'Collapse all code' : 'Expand all code';
  });

  document.addEventListener('click', (event) => {
    const copyButton = event.target.closest('[data-copy-code]');

    if (copyButton) {
      copyCode(copyButton);
    }
  });

  openPeriodSelectorButton.addEventListener('click', () => {
    const monthButton = featuredHost.querySelector('.tdp-select__data--month');

    if (monthButton) {
      monthButton.click();
      monthButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });

  // The demo intentionally starts in dark mode on every load.
  applyTheme('dark');
  currentValue.textContent = permanentPicker.val() || featuredPicker.val() || 'No date selected';
})();
