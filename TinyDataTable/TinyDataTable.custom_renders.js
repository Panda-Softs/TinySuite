(function (TinyDataTable) {
    // Detect mobile user agents to decide whether to render tel: links
    const _isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    // -----------------------------
    // Common helpers
    // -----------------------------

    // Normalize incoming values (TinyDataTable often passes raw values)
    const _norm = (v) => String(v).trim();

    // You already have this helper in your codebase.
    // Used to test functions without relying on typeof checks everywhere.
    // eslint-disable-next-line no-undef
    const _isFn = (v) => isFn(v);

    /**
     * "Display only" wrapper:
     * - display: calls displayFn({ s, value, row, ctx })
     * - non-display: returns a stable primitive for sort/filter/export
     */
    const _displayOnly = (displayFn) => ({ value, row, ctx }) => {
        if (ctx._blank(value)) return '';
        const s = _norm(value);
        if (ctx.phase !== 'display') return s;
        return displayFn({ s, value, row, ctx });
    };

    /**
     * Build badges from a comma-separated string.
     *
     * @param {any} value - usually "A,B,C"
     * @param {Object} ctx - TinyDataTable render context
     * @param {string|function} [className] - extra class(es) applied per badge.
     *   - string: "badge-sm badge-blue"
     *   - function: (item) => "badge-blue"
     *
     * Returns:
     * - display: Node (wrapper span containing badge spans)
     * - non-display: string "A, B, C"
     */
    const _badges = (value, ctx, className) => {
        if (ctx._blank(value)) return '';

        const items = String(value).split(',').map((s) => s.trim()).filter(Boolean);

        if (!items.length) return '';

        // Non-display phases: stable primitive for sort/filter/export
        if (ctx.phase !== 'display') return items.join(', ');

        const wrap = document.createElement('span');
        wrap.className = 'tt-badges';

        for (const item of items) {
            const badge = document.createElement('span');
            badge.className = 'badge';
            badge.textContent = item;

            // Resolve className: string or (item) => string
            let extra = _isFn(className) ? className(item) : (typeof className === 'string' ? className : '');

            if (extra) badge.classList.add(...String(extra).split(' ').filter(Boolean));

            wrap.appendChild(badge);
            wrap.appendChild(document.createTextNode(' ')); // spacing
        }

        return wrap;
    };

    /**
     * Generic single badge renderer:
     * - value is normalized (string)
     * - label is derived from fnLabel(value)
     * - extraClass is optional string (space-separated)
     * - returns Node only in display phase
     */
    const _badgeRenderer = (fnLabel, extraClass = '') => ({ value, ctx }) => {
        if (ctx._blank(value)) return '';
        const s = _norm(value);
        if (ctx.phase !== 'display') return s;
        const badge = document.createElement('span');
        badge.className = `badge ${s.toUpperCase()}`;
        if (extraClass) badge.classList.add(...String(extraClass).split(' ').filter(Boolean));
        badge.textContent = fnLabel(s);

        return badge;
    };

    const moneyWithZero = (zeroValue) => ({value, ctx}) => {
        if (ctx.phase !== 'display') return value;
        return (Number(value) === 0)
            ? zeroValue
            : TinyDataTable.typeRenderers.money({value, ctx});
    };

    // -----------------------------
    // Register TinyDataTable renderers
    // -----------------------------

    TinyDataTable.appendTypeRenderers({

        // Capitalize only in display mode (keep raw for sorting/searching)
        capitalize({ value, ctx }) {
            if (ctx._blank(value)) return '';
            const s = _norm(value);
            return ctx.phase === 'display' ? s?.capitalize() : s;
        },

        /**
         * Phone renderer:
         * - On mobile: displays formatted number as text
         * - On desktop: renders tel: link
         */
        phone({ value, row, ctx }) {
            if (ctx._blank(value)) return '';

            const input = _norm(value);

            if (ctx.phase !== 'display') return input;

            const parsed = phone_parse(input);

            const phoneNode = (() => {
                if (!parsed.text) return document.createTextNode('');

                const span = document.createElement('span');

                if (!parsed.isValid) {
                    span.className = 'phone-unformated';
                    span.textContent = parsed.text;
                    return span;
                }

                span.className = 'phone';

                if (parsed.kind === 'eu' && parsed.parts?.countryCode) {
                    const strong = document.createElement('strong');
                    strong.textContent = parsed.parts.countryCode;
                    span.appendChild(strong);
                    span.appendChild(document.createTextNode(` ${parsed.parts.rest}`));
                } else {
                    span.textContent = parsed.text;
                }

                return span;
            })();

            const tel = input.replace(/[^\d+]/g, '');

            const nameParts = [row?.lastname, row?.firstname]
                .map(v => v && String(v).trim())
                .filter(Boolean);

            const title = nameParts.length ? `Appeler ${nameParts.join(' ')}` : 'Appeler';

            const a = document.createElement('a');
            a.className = 'phone-link';
            a.href = `tel:${tel}`;
            a.title = title;
            a.appendChild(phoneNode);

            return a;
        },

        // Mailto renderer (node-based)
        email: ({ value, ctx }) => {
            if (ctx._blank(value)) return '';
            const s = _norm(value);

            if (ctx.phase !== 'display') return s;

            const a = document.createElement('a');
            a.className = 'mailto';
            a.href = `mailto:${s}`;
            a.textContent = s;

            return a;
        },

        // Comma-separated badges (node-based)
        badges: ({ value, ctx }) => _badges(value, ctx),

        // Same but with a per-item class mapper (string or function)
        badges_abo: ({ value, ctx }) => _badges(value, ctx, Renderer.subscription_color),

        /**
         * Short datetime:
         * - display: shows date + tooltip with full datetime
         * - non-display: stable formatted date for sort/search/export
         */
        datetime_short: ({ value, ctx }) => {
            if (ctx._blank(value)) return '';

            const s = _norm(value);

            if (ctx.phase !== 'display') {
                return formatDate(s, MC.m_date_locale_format);
            }

            const title = formatDate(s, MC.m_datetime_locale_day_format);
            const text = formatDate(s, MC.m_date_locale_format);

            const span = document.createElement('span');
            span.textContent = text;
            span.dataset.tooltip = title;

            return span;
        },

        /**
         * Date range renderer:
         * - value is the start date
         * - row[endKey] is the end date
         * - mode "day": displays dates only
         * - mode "hours": displays dates and compact times, omitting zero minutes
         * - when both datetimes are on the same day in "hours" mode,
         *   the end date is omitted
         * - in "hours" mode, the duration is also displayed after the range
         * - display phase: returns a DOM node with a tooltip
         * - non-display phases: return a stable formatted string
         *
         * Examples:
         * - day:   05.07.2026 → 06.07.2026
         * - hours: 05.07.2026 16h30 → 17h (30 minutes)
         * - hours: 05.07.2026 16h30 → 17h10 (40 minutes)
         * - hours: 05.07.2026 16h30 → 06.07.2026 15h (23 heures)
         */
        datetime_range: (endKey, mode = 'day') => ({ value, row, ctx }) => {
            if (ctx._blank(value)) return '';

            const isHoursMode = mode === 'hours';
            const startNorm = _norm(value);
            const endRaw = row?.[endKey];
            const hasEnd = !ctx._blank(endRaw);
            const endNorm = hasEnd ? _norm(endRaw) : null;

            const mStart = parse_date_to_moment(startNorm);
            const mEnd = hasEnd ? parse_date_to_moment(endNorm) : null;

            /**
             * Format a time using compact French notation.
             * Zero minutes are omitted: 17:00 becomes "17h".
             */
            const formatTime = date => {
                return date.format(date.minutes() === 0 ? 'H[h]' : 'H[h]mm');
            };

            /**
             * Build the formatted start and end values according to the selected mode.
             */
            const buildRangeTexts = () => {
                const startDate = mStart.format(MC.m_date_locale_format);

                if (!isHoursMode) {
                    return {
                        startText: startDate,
                        endText: hasEnd
                            ? mEnd.format(MC.m_date_locale_format)
                            : ''
                    };
                }

                const startText = `${startDate} ${formatTime(mStart)}`;

                if (!hasEnd) {
                    return {
                        startText,
                        endText: ''
                    };
                }

                const endTime = formatTime(mEnd);
                const endText = mStart.isSame(mEnd, 'day')
                    ? endTime
                    : `${mEnd.format(MC.m_date_locale_format)} ${endTime}`;

                return {
                    startText,
                    endText
                };
            };

            const { startText, endText } = buildRangeTexts();
            const rangeText = hasEnd ? `${startText} \u2192 ${endText}` : startText;
            const durationText = hasEnd ? mStart.from(mEnd, true) : '';
            const formattedText = isHoursMode && durationText
                ? `${rangeText} (${durationText})`
                : rangeText;

            if (ctx.phase !== 'display') {
                return formattedText;
            }

            const wrapper = document.createElement('span');
            wrapper.className = 'tt-datetime-range';

            // Keep the duration in the tooltip in both modes.
            wrapper.dataset.tooltip = hasEnd
                ? `${rangeText} (${durationText})`
                : startText;

            const startSpan = document.createElement('span');
            startSpan.textContent = startText;
            wrapper.appendChild(startSpan);

            if (hasEnd) {
                const arrow = document.createElement('span');
                arrow.textContent = ' \u2192 ';

                const endSpan = document.createElement('span');
                endSpan.textContent = endText;

                wrapper.append(arrow, endSpan);

                // In hours mode, also display the duration directly after the range.
                if (isHoursMode && durationText) {
                    const durationSpan = document.createElement('span');
                    durationSpan.className = 'tt-datetime-range-duration';
                    durationSpan.textContent = ` (${durationText})`;
                    wrapper.appendChild(durationSpan);
                }
            }

            return wrapper;
        },

        /**
         * Date renderer (node-based)
         * - display: formatted date + tooltip with "day format"
         * - non-display: stable primitive via _displayOnly
         */
        date: _displayOnly(({ s }) => {
            const title = formatDate(s, MC.m_date_locale_day_format);
            const txt = formatDate(s, MC.m_date_locale_format);

            const span = document.createElement('span');
            span.textContent = txt;
            span.dataset.tooltip = title;

            return span;
        }),

        /**
         * Client link renderer (node-based)
         * - Uses _BASE.client_view_url and id from given column (default "client_id")
         */
        client_link: (column = 'client_id') => ({ value, row, ctx }) => {
            if (ctx._blank(value)) return '';
            const s = _norm(value);

            if (ctx.phase !== 'display') return s;

            const href = urlFor(_BASE.client_view_url, { id: row?.[column] });

            const a = document.createElement('a');
            a.className = 'link';
            a.href = href;

            // NOTE: your tooltip system seems to accept HTML in data-tooltip.
            // If it supports only text, remove <strong> and keep plain text.
            a.dataset.tooltip = `Voir le client ${s}`;
            a.textContent = s;

            return a;
        },

        status_badge: _badgeRenderer(fn_rental_status),
        sale_type_badge: _badgeRenderer(fn_sales_types, 'badge-sale-type'),
        pay_method_badge: _badgeRenderer(fn_payment_method, 'badge-payment-type'),
        sales_types_badge: _badgeRenderer(fn_sales_types, 'badge-sm'),

        entity_types_badge: _badgeRenderer(fn_entity_types, 'badge-entity-type'),
        entity_subtypes_badge: _badgeRenderer(fn_entity_subtypes, 'badge-entity-subtype'),

        /**
         * Unified status renderer:
         * - Delegates to existing badge renderers depending on record_type
         */
        unified_status: _displayOnly(({ s, row, ctx }) => {
            switch (row?.record_type) {
                case 'RENTAL':
                case 'RENTAL_GROUP':
                    return TinyDataTable.typeRenderers.status_badge({ value: s, row, ctx });
                case 'SALE':
                    return TinyDataTable.typeRenderers.sale_type_badge({ value: s, row, ctx });
                default:
                    return s;
            }
        }),

        payment_method: _displayOnly(({ s }) => fn_payment_method_label(s)),

        // Code renderer (node-based)
        code: ({ value, ctx }) => {
            if (ctx._blank(value)) return '';
            const s = _norm(value);

            if (ctx.phase !== 'display') return s;

            const code = document.createElement('code');
            code.className = 'copyable';
            code.textContent = s;

            return code;
        },

        money_delta: moneyWithZero('~'),
        money_blank_zero: moneyWithZero(''),

        /**
         * boolean_icon(trueIcon, falseIcon)
         * - display: material icon node
         * - non-display: stable primitive (1/0)
         */
        boolean_icon: (trueIcon = 'check_circle', falseIcon = 'cancel') =>
            ({ value, ctx }) => {
                if (ctx.phase !== 'display') return value ? 1 : 0;

                const icon = document.createElement('i');
                icon.className = 'material-icons';
                if (!!value) {
                    icon.classList.add('text-success');
                    icon.textContent = trueIcon;
                } else {
                    icon.classList.add('text-danger');
                    icon.textContent = falseIcon;
                }
                return icon;
            },
    });
})(TinyDataTable);