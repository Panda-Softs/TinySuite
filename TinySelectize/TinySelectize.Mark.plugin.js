/*!
 * TinySelectize Mark.js plugin (UMD-lite)
 * Requires Mark.js to be loaded globally as `Mark`
 */
!function (TinySelectize) {
    if (!TinySelectize || typeof TinySelectize.definePlugin !== 'function') {
        throw new Error('TinySelectize Mark plugin: TinySelectize.definePlugin not found');
    }

    TinySelectize.definePlugin('mark', function markPlugin(userOpts) {
        var opts = Object.assign({
            // Scope inside each option row to highlight (keep narrow for perf)
            //selector: ,
            minChars: 1,
            markOptions: {
                separateWordSearch: false,
                diacritics: true,
                caseSensitive: false,
                exclude: ['i', 'i *', '.no-hl', '.no-hl *'],
            }
        }, userOpts || {});

        function hasMarkJs() {
            return typeof Mark === 'function';
        }

        return {
            name: 'mark',

            onOptionRow: function (row, opt, instance) {
                if (!hasMarkJs()) return;

                var q = (instance && instance.state && instance.state.query) ? String(instance.state.query).trim() : '';
                if (!q || q.length < opts.minChars) {
                    // Clear previous marks if any
                    try { new Mark(row).unmark(); } catch (e) {}
                    return;
                }

                var scope = opts.selector ? (row.querySelector(opts.selector) || row) : row;

                try {
                    var m = new Mark(scope);
                    m.unmark({
                        done: function () {
                            m.mark(q, opts.markOptions);
                        }
                    });
                } catch (e) {
                    // ignore
                }
            }
        };
    });

}(TinySelectize);