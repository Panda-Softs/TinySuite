/* TinyDataTable.export.js */

(function (global, TinyDataTable) {

    function sanitizeFilename (name) {
        if (!name) return 'export';

        return String(name)
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9._-]+/g, '_')
            .replace(/_{2,}/g, '_')
            .replace(/^_+|_+$/g, '')
            .toLowerCase() || 'export';
    };

    function normalizeFilename(name, ext) {
        if (!name) name = 'export';
        if (!new RegExp(`\\.${ext}$`, 'i').test(name)) {
            name += '.' + ext;
        }
        return name;
    };

    /* ============================
     * Type normalization
     * ============================ */

    function normalizeType(t)  {
        return t == null ? '' : String(t).toLowerCase();
    };

    function coerceValueByType(value, type) {
        if (value == null) return '';

        // Normalize to string early for parsing
        const s = typeof value === 'string' ? value.trim() : value;

        switch (type) {
            case 'int': {
                const n = parseInt(s, 10);
                return Number.isFinite(n) ? n : '';
            }

            case 'float': {
                const n = parseFloat(
                    typeof s === 'string' ? s.replace(',', '.') : s
                );
                return Number.isFinite(n) ? n : '';
            }

            case 'percent': {
                if (typeof s === 'string') {
                    const cleaned = s.replace('%', '').replace(',', '.').trim();
                    const n = parseFloat(cleaned);
                    return Number.isFinite(n) ? n / 100 : '';
                }
                if (typeof s === 'number') {
                    return s > 1 ? s / 100 : s;
                }
                return '';
            }

            case 'date': {
                const d = s instanceof Date ? s : new Date(s);
                return isNaN(d.getTime()) ? '' : d;
            }

            case 'string':
            default:
                return String(s);
        }
    }


    /* ============================
     * Export matrix builder
     * ============================ */

    /**
     * Returns:
     * {
     *   headers: [{ label, type }],
     *   rows:    [[value, value, ...]]
     * }
     */
    function buildMatrix(table) {
        const api = table.api();

        return api.getFullData(true, true).then(({ headers, rows }) => {

            const normalizedRows = rows.map(row =>
                row.map((cell, i) =>
                    coerceValueByType(cell, headers[i]?.type)
                )
            );

            return {
                headers: headers,
                rows: normalizedRows
            };
        });
    };

    /* ============================
     * CSV export
     * ============================ */

    function exportCSV(table, filename) {
        const name = normalizeFilename(sanitizeFilename(filename), 'csv');

        return buildMatrix(table).then(({ headers, rows }) => {
            const escape = v => {
                if (v == null) return '';
                // Normalize line endings
                let s = String(v).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                // Prevent CSV injection (Excel, LibreOffice)
                if (/^[=+\-@]/.test(s)) {
                    s = "'" + s;
                }
                return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
            };

            const lines = [];
            lines.push(headers.map(h => escape(h.label)).join(','));

            rows.forEach(r => {
                lines.push(r.map(escape).join(','));
            });

            const blob = new Blob([lines.join('\r\n')], {
                type: 'text/csv;charset=utf-8;'
            });

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = name;
            a.click();
            URL.revokeObjectURL(url);
        });
    };

    /* ============================
     * Excel export (SheetJS)
     * ============================ */

    function exportExcel(table, sheetname, filename) {
        if (!global.XLSX) {
            throw new Error('SheetJS (XLSX) is not loaded');
        }

        sheetname = sheetname || 'Sheet1';

        const name = normalizeFilename(sanitizeFilename(filename || sheetname), 'xlsx');

        return buildMatrix(table).then(({ headers, rows }) => {
            const data = [
                headers.map(h => h.label),
                ...rows
            ];

            const ws = XLSX.utils.aoa_to_sheet(data);

            headers.forEach((h, c) => {
                const type = normalizeType(h.type);

                for (let r = 1; r < data.length; r++) {
                    const addr = XLSX.utils.encode_cell({ r, c });
                    const cell = ws[addr];
                    if (!cell) continue;

                    if (type === 'date' || type === 'datetime') {
                        cell.t = 'd';
                        cell.z = type === 'date'
                            ? 'yyyy-mm-dd'
                            : 'yyyy-mm-dd hh:mm';
                    }
                }
            });

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, sheetname);
            XLSX.writeFile(wb, name);
        });
    };

    /* ============================
     * PDF export (jsPDF + autoTable)
     * ============================ */

    function exportPDF(table, title, filename) {
        if (
            !global.jspdf || !global.jspdf.jsPDF
        ) {
            throw new Error('jsPDF or jsPDF AutoTable plugin is not loaded');
        }

        const { jsPDF } = global.jspdf;
        const doc = new jsPDF({ orientation: 'landscape' });

        if (typeof doc.autoTable !== 'function') {
            throw new Error('AutoTable plugin not loaded');
        }

        title = title || 'Export';
        const name = normalizeFilename(sanitizeFilename(filename || title), 'pdf');

        return buildMatrix(table).then(({ headers, rows }) => {
            doc.setFontSize(14);
            doc.text(title, 14, 15);

            doc.autoTable({
                startY: 20,
                head: [headers.map(h => h.label)],
                body: rows,
                styles: { fontSize: 9 }
            });

            doc.save(name);
        });
    };

    /* ============================
     * Public API
     * ============================ */
    TinyDataTable.registerExporter('csv', {
        export(table, filename) {
            return exportCSV(table, filename);
        }
    });
    TinyDataTable.registerExporter('xlsx', {
        export(table, sheetname, filename) {
            return exportExcel(table, sheetname, filename);
        }
    });
    TinyDataTable.registerExporter('pdf', {
        export(table, title, filename) {
            return exportPDF(table, title, filename);
        }
    });


})(window, TinyDataTable);
