const demoLocale = navigator.languages?.[0] || navigator.language || 'en';
const demoLogElement = document.getElementById('eventLog');
const clearLogButton = document.getElementById('clearLog');
const languageSwitch = document.getElementById('languageSwitch');

let activeLocale = localStorage.getItem('tiny-scheduler-demo-locale') || 'auto';
let mainFrame = null;
let ajaxScheduler = null;

const demoResources = [
  { id: 'room-a', title: 'Room A', order: 1 },
  { id: 'room-b', title: 'Room B', order: 2 },
  { id: 'room-c', title: 'Room C', order: 3 },
  { id: 'room-d', title: 'Room D', order: 4 },
  { id: 'auditorium-a', title: 'Auditorium A', order: 10 },
  { id: 'auditorium-b', title: 'Auditorium B', order: 11 },
  { id: 'auditorium-c', title: 'Auditorium C', order: 12 },
  { id: 'auditorium-d', title: 'Auditorium D', order: 13 },
  { id: 'room-d1', title: 'Room D1', parentId: 'auditorium-d', order: 14 },
  { id: 'room-d2', title: 'Room D2', parentId: 'auditorium-d', order: 15 },
  { id: 'auditorium-e', title: 'Auditorium E', order: 16 },
  { id: 'auditorium-f', title: 'Auditorium F', order: 17 }
];

const initialEvents = [
  { id: 'all-day-event', title: 'All Day Event', text: 'June opening all-day event', start: '2026-06-01', end: '2026-06-02', allDay: true },
  { id: 'long-event', title: 'Long Event', text: 'Multi-day event', start: '2026-06-07', end: '2026-06-10', allDay: true },
  { id: 'conference', title: 'Conference', text: 'Annual conference', start: '2026-06-21', end: '2026-06-23', allDay: true },
  { id: 'meeting-am', title: 'Meeting', text: 'Team meeting', start: '2026-06-22T10:30:00', end: '2026-06-22T12:30:00' },
  { id: 'lunch', title: 'Lunch', text: 'Lunch appointment', start: '2026-06-22T12:00:00', end: '2026-06-22T13:00:00' },
  { id: 'meeting-pm', title: 'Meeting', text: 'Afternoon meeting', start: '2026-06-22T14:30:00', end: '2026-06-22T15:30:00' },
  { id: 'happy-hour', title: 'Happy Hour', text: 'After work drinks', start: '2026-06-22T17:30:00', end: '2026-06-22T18:30:00' },
  { id: 'dinner', title: 'Dinner', text: 'Dinner with team', start: '2026-06-22T20:00:00', end: '2026-06-22T21:00:00' },
  { id: 'birthday', title: 'Birthday Party', text: 'Birthday party', start: '2026-06-23T07:00:00', end: '2026-06-23T08:00:00' },
  { id: 'rtg-event-1', title: 'Room A Setup', text: 'All-day Room A', start: '2026-06-23', end: '2026-06-24', allDay: true, resourceId: 'room-a' },
  { id: 'rtg-event-2', title: 'Room A Booking', text: 'Workshop', start: '2026-06-23T09:00:00', end: '2026-06-23T14:00:00', resourceId: 'room-a' },
  { id: 'rtg-event-3', title: 'Room B Booking', text: 'Client room', start: '2026-06-23T12:00:00', end: '2026-06-23T18:30:00', resourceId: 'room-b' },
  { id: 'rtl-event-1', title: 'Auditorium D', text: 'Full day', start: '2026-06-23T06:00:00', end: '2026-06-23T18:00:00', resourceId: 'auditorium-d' },
  { id: 'rtl-event-2', title: 'Room D2', text: 'Booking', start: '2026-06-23T09:00:00', end: '2026-06-23T14:00:00', resourceId: 'room-d2' },
  { id: 'rtl-event-3', title: 'Auditorium C', text: 'Orange event', start: '2026-06-23T12:00:00', end: '2026-06-23T18:00:00', resourceId: 'auditorium-c', color: '#ff9800' }
];

const ajaxSourceData = {
  'ajax-source-blue.json': {
    items: [
      { uid: 'blue-standup-22', name: 'Standup', details: 'Blue source daily sync', starts_at: '2026-06-22T09:00:00', ends_at: '2026-06-22T09:30:00' },
      { uid: 'blue-roadmap-22', name: 'Roadmap', details: 'Product roadmap alignment', starts_at: '2026-06-22T11:00:00', ends_at: '2026-06-22T12:00:00' },
      { uid: 'blue-qa-23', name: 'QA Session', details: 'Regression pass', starts_at: '2026-06-23T08:30:00', ends_at: '2026-06-23T10:00:00' }
    ]
  },
  'ajax-source-orange.json': {
    items: [
      { uid: 'orange-sales-22', name: 'Sales Call', details: 'Orange source sales call', starts_at: '2026-06-22T10:00:00', ends_at: '2026-06-22T10:45:00' },
      { uid: 'orange-contract-22', name: 'Contract Review', details: 'Legal review', starts_at: '2026-06-22T13:00:00', ends_at: '2026-06-22T14:00:00' },
      { uid: 'orange-client-23', name: 'Client Meeting', details: 'Customer requirements', starts_at: '2026-06-23T09:30:00', ends_at: '2026-06-23T10:30:00' }
    ]
  }
};

function getActiveLocale() {
  if (activeLocale === 'fr') return 'fr';
  if (activeLocale === 'en') return 'en';
  return demoLocale;
}

function logEvent(name, detail = '') {
  if (!demoLogElement) return;

  const row = document.createElement('div');
  row.className = 'demo-log-row';
  row.innerHTML = `<strong>${name}</strong><span>${detail}</span>`;
  demoLogElement.prepend(row);
}

function installMockFetch() {
  const originalFetch = window.fetch?.bind(window);

  window.fetch = async url => {
    const path = String(url).split('/').pop().split('?')[0];

    if (ajaxSourceData[path]) {
      return new Response(JSON.stringify(ajaxSourceData[path]), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    if (originalFetch) return originalFetch(url);

    return new Response('Not found', { status: 404, statusText: 'Not Found' });
  };
}

function openEventForm({ title = '', text = '', mode = 'add' } = {}) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'demo-modal-backdrop';
    overlay.innerHTML = `
      <form class="demo-modal" aria-label="${mode === 'edit' ? 'Edit event' : 'Add event'}">
        <header>
          <strong>${mode === 'edit' ? 'Edit event' : 'Add event'}</strong>
          <button type="button" class="demo-modal-close" aria-label="Close">×</button>
        </header>
        <label>
          <span>Title</span>
          <input name="title" required value="${escapeHtml(title)}" placeholder="Meeting">
        </label>
        <label>
          <span>Text</span>
          <textarea name="text" rows="3" placeholder="Description">${escapeHtml(text)}</textarea>
        </label>
        <footer>
          <button type="button" data-modal-cancel>Cancel</button>
          <button type="submit">${mode === 'edit' ? 'Save' : 'Add'}</button>
        </footer>
      </form>
    `;

    const close = value => {
      overlay.remove();
      resolve(value);
    };

    overlay.querySelector('.demo-modal-close').addEventListener('click', () => close(null));
    overlay.querySelector('[data-modal-cancel]').addEventListener('click', () => close(null));
    overlay.addEventListener('click', event => {
      if (event.target === overlay) close(null);
    });

    overlay.querySelector('form').addEventListener('submit', event => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      close({
        title: String(formData.get('title') || '').trim(),
        text: String(formData.get('text') || '').trim()
      });
    });

    document.body.append(overlay);
    overlay.querySelector('input').focus();
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function createMainFrame() {
  mainFrame?.destroy?.();
  document.getElementById('calendarApp').innerHTML = '';

  mainFrame = new TinySchedulerFrame('#calendarApp', {
    stateStorage: {
      key: 'tiny-scheduler-main-demo'
    },
    calendar: {
      locale: getActiveLocale(),
      initialDate: '2026-06-22',
      initialView: 'week',
      firstDay: 1,
      editable: true,
      selectable: true,
      autoScroll: true,
      autoScrollTarget: 'firstEvent',
      toolbar: {
        left: ['sidebarToggle', 'prev', 'next', 'today', 'addEvent', 'deleteEvent'],
        center: ['title'],
        right: ['month', 'week', 'day', 'list', 'planning']
      },
      timeFormat: {
        omitZeroMinutes: true
      },
      events: initialEvents.map(event => ({ ...event })),
      resources: demoResources,
      eventActionToolbar: true,
      onSelect(info) {
        logEvent('select', `${formatDemoDate(info.start)} → ${formatDemoDate(info.end)}`);
      },
      onEventClick(info) {
        logEvent('eventClick', info.event.title);
      },
      async onEventEdit(info) {
        const updates = await openEventForm({
          mode: 'edit',
          title: info.event.title,
          text: info.event.text
        });

        if (!updates) return false;
        logEvent('eventEdit', updates.title);
        return updates;
      },
      async onEventDelete(info) {
        const shouldDelete = window.confirm(`Delete "${info.event.title}"?`);
        logEvent('eventDelete', shouldDelete ? info.event.title : 'cancelled');
        return shouldDelete;
      },
      async onEventAdd(info) {
        const values = await openEventForm({ mode: 'add' });

        if (!values) return false;

        const event = {
          id: `demo-${Date.now()}`,
          title: values.title || 'New event',
          text: values.text,
          start: info.start,
          end: info.end,
          allDay: info.allDay,
          resourceId: info.resourceId
        };

        logEvent('eventAdd', event.title);
        return event;
      },
      eventTransform(rawEvent) {
        return {
          ...rawEvent,
          title: String(rawEvent.title || rawEvent.name || 'Untitled').trim()
        };
      }
    },
    sidebar: {
      initiallyCollapsed: false
    }
  });

  mainFrame.render();
}

function createAjaxCalendar() {
  ajaxScheduler?.destroy?.();
  document.getElementById('ajaxCalendar').innerHTML = '';

  ajaxScheduler = new TinyScheduler('#ajaxCalendar', {
    locale: getActiveLocale(),
    initialDate: '2026-06-22',
    initialView: 'week',
    firstDay: 1,
    toolbar: {
      left: ['prev', 'next', 'today'],
      center: ['title'],
      right: ['week', 'day', 'list']
    },
    eventSources: [
      {
        id: 'blue-source',
        url: 'ajax-source-blue.json',
        color: '#3b8edb',
        transformResponse(response) {
          return response.items;
        },
        eventTransform(item) {
          return {
            id: item.uid,
            title: item.name,
            text: item.details,
            start: item.starts_at,
            end: item.ends_at
          };
        },
        failure(errorInfo, failureCallback) {
          if (errorInfo.status === 401) return false;
          failureCallback(new Error(`Blue source failed: ${errorInfo.responseText || errorInfo.message}`));
        }
      },
      {
        id: 'orange-source',
        url: 'ajax-source-orange.json',
        color: '#ff9800',
        transformResponse(response) {
          return response.items;
        },
        eventTransform(item) {
          return {
            id: item.uid,
            title: item.name,
            text: item.details,
            start: item.starts_at,
            end: item.ends_at
          };
        }
      }
    ],
    onDataSourceError(errorInfo) {
      logEvent('dataSourceError', errorInfo.message);
    },
    onEventClick(info) {
      logEvent('ajax eventClick', info.event.title);
    }
  });

  ajaxScheduler.render();
}

function formatDemoDate(date) {
  return new Intl.DateTimeFormat(getActiveLocale(), {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function updateLanguageButtons() {
  languageSwitch?.querySelectorAll('[data-locale-mode]').forEach(button => {
    button.classList.toggle('active', button.dataset.localeMode === activeLocale);
  });
}

clearLogButton?.addEventListener('click', () => {
  if (demoLogElement) demoLogElement.innerHTML = '';
});

languageSwitch?.addEventListener('click', event => {
  const button = event.target.closest('[data-locale-mode]');
  if (!button) return;

  activeLocale = button.dataset.localeMode;
  localStorage.setItem('tiny-scheduler-demo-locale', activeLocale);
  updateLanguageButtons();
  createMainFrame();
  createAjaxCalendar();
});

installMockFetch();
updateLanguageButtons();
createMainFrame();
createAjaxCalendar();
