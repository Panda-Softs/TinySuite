/**
 * TinyT v3.8.0
 *
 * Fast browser-side templating for trusted application templates.
 *
 * Design goals:
 * - Compile templates once to native JavaScript and keep repeated renders allocation-light.
 * - Preserve the historical TinyT 3.x lookup, helper, nested-template and diagnostic semantics.
 * - Keep the parser self-contained instead of shipping a full JavaScript parser in the browser.
 * - Prefer measurable hot-path wins over speculative micro-optimizations.
 *
 * Security model:
 * Templates are trusted application code. TinyT evaluates JavaScript expressions through
 * generated functions and is not a sandbox. Never compile untrusted template source.
 *
 * Maintenance warning:
 * Parser and scope code contains compatibility-sensitive behavior. Seemingly simpler changes
 * to regex detection, `with`, Proxy usage, helper merging or `$index` propagation can alter
 * observable results. Keep regression tests and benchmarks beside any such change.
 */
const TinyT = (() => {
    // ---------------------------------------------------------------------------
    // Caches & registry
    // ---------------------------------------------------------------------------
    const looseCache = new Map();
    const strictCache = new Map();
    const store = new Map();
    const EMPTY_OBJ = Object.freeze(Object.create(null));

    // Global rendering defaults are intentionally small. Keeping the production defaults at
    // false/null lets the common path continue to reuse EMPTY_OBJ with no merge allocation.
    const defaults = {
        missingToUndefined: false,
        onMissing: null
    };
    let defaultRuntimeOpts = EMPTY_OBJ;

    /** Rebuilds the internal runtime defaults only when configure() changes public defaults. */
    function refreshDefaultRuntimeOpts() {
        // A configured callback is dormant while global collection is disabled. This preserves the
        // allocation-free production path while still allowing a local missingToUndefined:true render
        // to inherit the callback through the resolver below.
        if (!defaults.missingToUndefined) {
            defaultRuntimeOpts = EMPTY_OBJ;
            return;
        }

        const runtimeDefaults = Object.create(null);
        runtimeDefaults.missingToUndefined = true;
        if (defaults.onMissing) runtimeDefaults.onMissing = defaults.onMissing;
        defaultRuntimeOpts = runtimeDefaults;
    }

    /**
     * Updates global runtime defaults. Per-render options always win when explicitly provided.
     * `onMissing: null` clears the global callback. Returning a frozen snapshot keeps the mutable
     * internal configuration private while still exposing the effective values to callers.
     */
    function configure(options) {
        if (!options || typeof options !== "object" || Array.isArray(options)) {
            throw new TypeError("configure: expected an options object");
        }
        for (const key of Object.keys(options)) {
            if (key !== "missingToUndefined" && key !== "onMissing") {
                throw new TypeError(`configure: unknown option "${key}"`);
            }
        }

        const hasMissingMode = Object.prototype.hasOwnProperty.call(options, "missingToUndefined");
        const hasOnMissing = Object.prototype.hasOwnProperty.call(options, "onMissing");

        // Validate the complete update before mutating defaults so configure() is atomic.
        if (hasOnMissing && options.onMissing !== null && typeof options.onMissing !== "function") {
            throw new TypeError("configure: onMissing must be a function or null");
        }

        if (hasMissingMode) defaults.missingToUndefined = !!options.missingToUndefined;
        if (hasOnMissing) defaults.onMissing = options.onMissing;

        refreshDefaultRuntimeOpts();
        return Object.freeze({
            missingToUndefined: defaults.missingToUndefined,
            onMissing: defaults.onMissing
        });
    }

    /** Canonicalizes public template ids once so internal hot paths never repeat `#` stripping. */
    const normalizeTemplateId = (id) => {
        id = String(id);
        return id.startsWith("#") ? id.slice(1) : id;
    };

    /** Creates one registry record containing source plus lazily cached loose/strict renderers. */
    function createTemplateEntry(source) {
        return { source: String(source), loose: null, strict: null };
    }

    // ---------------------------------------------------------------------------
    // Template registry
    // ---------------------------------------------------------------------------
    /** Replaces a registered template and intentionally invalidates renderers attached to its old source. */
    function registerTemplate(id, tpl) {
        store.set(normalizeTemplateId(id), createTemplateEntry(tpl));
    }

    /** Resolves an already-normalized id, lazily importing DOM-backed templates only on first access. */
    function getTemplateEntryNormalized(id) {
        let entry = store.get(id);
        if (entry) return entry;

        if (typeof document !== "undefined") {
            const el = document.getElementById(id);
            if (el) {
                entry = createTemplateEntry(el.innerHTML);
                store.set(id, entry);
                return entry;
            }
        }

        throw new Error(`Template "${id}" not found`);
    }

    /** Keeps public id normalization at the API boundary rather than inside internal lookup loops. */
    function getTemplateEntry(id) {
        return getTemplateEntryNormalized(normalizeTemplateId(id));
    }

    /** Returns only template source so callers cannot mutate private renderer-cache state. */
    function getTemplate(id) {
        return getTemplateEntry(id).source;
    }

    /** Clears global caches and registry-local renderer references together to prevent stale compiled code. */
    function clearCache() {
        looseCache.clear();
        strictCache.clear();
        for (const entry of store.values()) {
            entry.loose = null;
            entry.strict = null;
        }
    }

    /** Exposes cache size for diagnostics without exposing the mutable cache objects themselves. */
    function cacheSize() {
        return looseCache.size + strictCache.size;
    }

    // ---------------------------------------------------------------------------
    // Small helpers
    // ---------------------------------------------------------------------------
    /** Escapes literal template text for generated JavaScript; this is deliberately not HTML escaping. */
    const esc = (s) =>
        s.replace(/\\/g, "\\\\")
            .replace(/`/g, "\\`")
            .replace(/\r/g, "\\r")
            .replace(/\n/g, "\\n");

    // Keep the established ASCII scanner unchanged on the common path. Unicode
    // property checks are only reached after the ASCII predicates fail.
    const isIdentifierStart = (ch) => /[A-Za-z_$]/.test(ch);
    const isIdentifierPart = (ch) => /[A-Za-z0-9_$]/.test(ch);
    const unicodeIdentifierStart = /[\p{ID_Start}]/u;
    const unicodeIdentifierPart = /[\p{ID_Continue}]/u;

    /** Reads a non-ASCII JavaScript identifier start without slowing the normal ASCII branch. */
    function unicodeIdentifierStartLength(str, index) {
        const code = str.charCodeAt(index);
        if (code < 128 || Number.isNaN(code)) return 0;
        const cp = str.codePointAt(index);
        return unicodeIdentifierStart.test(String.fromCodePoint(cp)) ? (cp > 0xFFFF ? 2 : 1) : 0;
    }

    /** Reads a non-ASCII identifier continuation, including the ECMAScript ZWNJ/ZWJ exceptions. */
    function unicodeIdentifierPartLength(str, index) {
        const code = str.charCodeAt(index);
        if (code === 0x200C || code === 0x200D) return 1;
        if (code < 128 || Number.isNaN(code)) return 0;
        const cp = str.codePointAt(index);
        return unicodeIdentifierPart.test(String.fromCodePoint(cp)) ? (cp > 0xFFFF ? 2 : 1) : 0;
    }

    /** Scans a complete binding identifier for directive-alias validation and top-level `as` parsing. */
    function scanIdentifierEnd(str, index) {
        let startLen = isIdentifierStart(str[index]) ? 1 : unicodeIdentifierStartLength(str, index);
        if (!startLen) return -1;
        let end = index + startLen;
        while (end < str.length) {
            if (isIdentifierPart(str[end])) { end++; continue; }
            const unicodeLen = unicodeIdentifierPartLength(str, end);
            if (!unicodeLen) break;
            end += unicodeLen;
        }
        return end;
    }

    /** Uses char codes for regex-flag scanning to avoid another regular-expression test per flag. */
    function isAsciiLetterCode(code) {
        return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
    }

    /** Cheap digit predicate used where only a numeric-literal start must be recognized. */
    function isDecimalDigitCode(code) {
        return code >= 48 && code <= 57;
    }

    const regexPrefixKeywords = new Set([
        "await", "case", "delete", "do", "else", "in", "instanceof", "of",
        "return", "throw", "typeof", "void", "yield",
        // TinyT directive prefixes are scanned before their JavaScript expression.
        "if", "elsif", "html", "each"
    ]);

    /** Skips a JS quoted string so TinyT delimiters inside escaped/string content remain inert. */
    function skipQuotedString(str, start, quote) {
        for (let i = start + 1; i < str.length; i++) {
            const ch = str[i];
            if (ch === "\\") { i++; continue; }
            if (ch === quote) return i + 1;
        }
        return -1;
    }

    /** Skips line comments because braces/slashes inside comments must not affect delimiter matching. */
    function skipLineComment(str, start) {
        const end = str.indexOf("\n", start + 2);
        return end === -1 ? str.length : end + 1;
    }

    /** Skips block comments and reports unterminated comments to the surrounding scanner. */
    function skipBlockComment(str, start) {
        const end = str.indexOf("*/", start + 2);
        return end === -1 ? -1 : end + 2;
    }

    /** Skips a JS regex literal, including escapes/classes; caller decides whether `/` can begin a regex. */
    function skipRegexLiteral(str, start) {
        let inClass = false;
        for (let i = start + 1; i < str.length; i++) {
            const ch = str[i];
            if (ch === "\\") { i++; continue; }
            if (ch === "[" && !inClass) { inClass = true; continue; }
            if (ch === "]" && inClass) { inClass = false; continue; }
            if (ch === "/" && !inClass) {
                i++;
                while (i < str.length && isAsciiLetterCode(str.charCodeAt(i))) i++;
                return i;
            }
            if ((ch === "\n" || ch === "\r") && !inClass) return -1;
        }
        return -1;
    }

    /** Advances over numeric literals only to maintain correct lexical context for following operators. */
    function skipNumber(str, start) {
        let i = start;
        if (str[i] === "0" && /[xXbBoO]/.test(str[i + 1] || "")) {
            i += 2;
            while (i < str.length && /[0-9A-Fa-f_]/.test(str[i])) i++;
            return i;
        }
        while (i < str.length && /[0-9_]/.test(str[i])) i++;
        if (str[i] === ".") {
            i++;
            while (i < str.length && /[0-9_]/.test(str[i])) i++;
        }
        if (/[eE]/.test(str[i] || "")) {
            let j = i + 1;
            if (str[j] === "+" || str[j] === "-") j++;
            const exponentStart = j;
            while (j < str.length && /[0-9_]/.test(str[j])) j++;
            if (j > exponentStart) i = j;
        }
        if (str[i] === "n") i++;
        return i;
    }

    /**
     * Finds the end of JavaScript embedded in TinyT syntax while ignoring braces
     * inside strings, comments, template literals and regex literals.
     *
     * mode="expression" starts inside `${` with one outstanding `}`.
     * mode="directive" starts after `{{` and ends at a top-level `}}`.
     */
    /**
     * Locates TinyT expression/directive boundaries with enough JS lexical awareness to ignore
     * delimiters inside strings, comments, regexes, nested braces and template literals.
     * Directive mode starts with regex disabled so the `/` in `{{/if}}` cannot consume following HTML.
     */
    function findJavaScriptEnd(str, start, mode) {
        let parenDepth = 0;
        let bracketDepth = 0;
        let braceDepth = mode === "expression" ? 1 : 0;
        let canStartRegex = mode === "expression";

        for (let i = start; i < str.length;) {
            const ch = str[i];
            const next = str[i + 1];

            if (/\s/.test(ch)) { i++; continue; }

            if (mode === "directive" && ch === "}" && next === "}" &&
                parenDepth === 0 && bracketDepth === 0 && braceDepth === 0) {
                return i;
            }

            if (ch === "'" || ch === '"') {
                const end = skipQuotedString(str, i, ch);
                if (end < 0) return -1;
                i = end;
                canStartRegex = false;
                continue;
            }

            if (ch === "`") {
                const end = skipTemplateLiteral(str, i);
                if (end < 0) return -1;
                i = end;
                canStartRegex = false;
                continue;
            }

            if (ch === "/" && next === "/") {
                i = skipLineComment(str, i);
                continue;
            }

            if (ch === "/" && next === "*") {
                const end = skipBlockComment(str, i);
                if (end < 0) return -1;
                i = end;
                continue;
            }

            if (ch === "/" && canStartRegex) {
                const end = skipRegexLiteral(str, i);
                if (end > 0) {
                    i = end;
                    canStartRegex = false;
                    continue;
                }
            }

            if (isIdentifierStart(ch)) {
                let end = i + 1;
                while (end < str.length) {
                    if (isIdentifierPart(str[end])) { end++; continue; }
                    if (str.charCodeAt(end) < 128) break;
                    const unicodeLen = unicodeIdentifierPartLength(str, end);
                    if (!unicodeLen) break;
                    end += unicodeLen;
                }
                const word = str.slice(i, end);
                canStartRegex = regexPrefixKeywords.has(word);
                i = end;
                continue;
            }
            if (isDecimalDigitCode(str.charCodeAt(i)) ||
                (ch === "." && isDecimalDigitCode(str.charCodeAt(i + 1)))) {
                i = skipNumber(str, i);
                canStartRegex = false;
                continue;
            }

            if (ch === "(") { parenDepth++; canStartRegex = true; i++; continue; }
            if (ch === ")") { if (parenDepth > 0) parenDepth--; canStartRegex = false; i++; continue; }
            if (ch === "[") { bracketDepth++; canStartRegex = true; i++; continue; }
            if (ch === "]") { if (bracketDepth > 0) bracketDepth--; canStartRegex = false; i++; continue; }
            if (ch === "{") { braceDepth++; canStartRegex = true; i++; continue; }
            if (ch === "}") {
                if (mode === "expression") {
                    braceDepth--;
                    if (braceDepth === 0) return i;
                } else if (braceDepth > 0) {
                    braceDepth--;
                }
                canStartRegex = false;
                i++;
                continue;
            }

            if ((ch === "+" || ch === "-") && next === ch) {
                i += 2;
                canStartRegex = false;
                continue;
            }

            if (ch === "." || (ch === "?" && next === ".")) {
                i += ch === "?" ? 2 : 1;
                canStartRegex = false;
                continue;
            }

            // Non-ASCII identifier starts are rare, so check them only after the common
            // ASCII operators/separators have taken their cheap paths above.
            if (str.charCodeAt(i) >= 128) {
                const unicodeStartLen = unicodeIdentifierStartLength(str, i);
                if (unicodeStartLen) {
                    let end = i + unicodeStartLen;
                    while (end < str.length) {
                        if (isIdentifierPart(str[end])) { end++; continue; }
                        if (str.charCodeAt(end) < 128) break;
                        const unicodeLen = unicodeIdentifierPartLength(str, end);
                        if (!unicodeLen) break;
                        end += unicodeLen;
                    }
                    i = end;
                    canStartRegex = false;
                    continue;
                }
            }

            // Operators and separators generally expect another expression.
            canStartRegex = true;
            i++;
        }

        return -1;
    }

    /** Recursively skips template literals because each `${...}` body can contain full nested JS syntax. */
    function skipTemplateLiteral(str, start) {
        for (let i = start + 1; i < str.length;) {
            const ch = str[i];
            if (ch === "\\") { i += 2; continue; }
            if (ch === "`") return i + 1;
            if (ch === "$" && str[i + 1] === "{") {
                const end = findJavaScriptEnd(str, i + 2, "expression");
                if (end < 0) return -1;
                i = end + 1;
                continue;
            }
            i++;
        }
        return -1;
    }

    /**
     * Finds the top-level ` as ` separator used by `{{each expression as value,index}}`.
     *
     * A plain `indexOf(" as ")` is incorrect because valid JavaScript expressions may contain
     * the same text inside strings, regexes, template literals, comments or nested expressions.
     * This scanner deliberately mirrors TinyT's JavaScript boundary rules and only accepts an
     * `as` token at lexical depth zero.
     */
    /**
     * Finds the `each ... as ...` separator only at lexical depth zero.
     * This prevents text such as `" as "`, `/ as /` or nested expressions from being mistaken for TinyT syntax.
     */
    function findTopLevelEachAs(spec) {
        let parenDepth = 0, bracketDepth = 0, braceDepth = 0;
        let canStartRegex = true;

        for (let i = 0; i < spec.length;) {
            const ch = spec[i];
            const next = spec[i + 1];
            const code = spec.charCodeAt(i);

            if (/\s/.test(ch)) { i++; continue; }
            if (ch === "'" || ch === '"') {
                const end = skipQuotedString(spec, i, ch);
                if (end < 0) return -1;
                i = end; canStartRegex = false; continue;
            }
            if (ch === "`") {
                const end = skipTemplateLiteral(spec, i);
                if (end < 0) return -1;
                i = end; canStartRegex = false; continue;
            }
            if (ch === "/" && next === "/") { i = skipLineComment(spec, i); continue; }
            if (ch === "/" && next === "*") {
                const end = skipBlockComment(spec, i);
                if (end < 0) return -1;
                i = end; continue;
            }
            if (ch === "/" && canStartRegex) {
                const end = skipRegexLiteral(spec, i);
                if (end > 0) { i = end; canStartRegex = false; continue; }
            }

            const identifierEnd = scanIdentifierEnd(spec, i);
            if (identifierEnd !== -1) {
                const end = identifierEnd;
                const word = spec.slice(i, end);
                if (word === "as" && parenDepth === 0 && bracketDepth === 0 && braceDepth === 0 &&
                    i > 0 && /\s/.test(spec[i - 1]) && end < spec.length && /\s/.test(spec[end])) {
                    return i;
                }
                canStartRegex = regexPrefixKeywords.has(word);
                i = end;
                continue;
            }

            if (isDecimalDigitCode(code) || (ch === "." && isDecimalDigitCode(spec.charCodeAt(i + 1)))) {
                i = skipNumber(spec, i); canStartRegex = false; continue;
            }
            if (ch === "(") { parenDepth++; canStartRegex = true; i++; continue; }
            if (ch === ")") { if (parenDepth) parenDepth--; canStartRegex = false; i++; continue; }
            if (ch === "[") { bracketDepth++; canStartRegex = true; i++; continue; }
            if (ch === "]") { if (bracketDepth) bracketDepth--; canStartRegex = false; i++; continue; }
            if (ch === "{") { braceDepth++; canStartRegex = true; i++; continue; }
            if (ch === "}") { if (braceDepth) braceDepth--; canStartRegex = false; i++; continue; }
            if ((ch === "+" || ch === "-") && next === ch) { i += 2; canStartRegex = false; continue; }
            if (ch === "." || (ch === "?" && next === ".")) { i += ch === "?" ? 2 : 1; canStartRegex = false; continue; }
            canStartRegex = true;
            i++;
        }
        return -1;
    }

    /** Validates generated loop aliases before `new Function` so errors point to TinyT syntax, not generated JS. */
    function isValidBindingIdentifier(name) {
        if (!name) return false;
        const end = scanIdentifierEnd(name, 0);
        return end === name.length && !RESERVED_BINDING_WORDS.has(name);
    }

    const RESERVED_BINDING_WORDS = new Set([
        "await", "break", "case", "catch", "class", "const", "continue", "debugger",
        "default", "delete", "do", "else", "enum", "export", "extends", "false",
        "finally", "for", "function", "if", "import", "in", "instanceof", "let",
        "new", "null", "return", "super", "switch", "this", "throw", "true", "try",
        "typeof", "var", "void", "while", "with", "yield"
    ]);

    /** Converts offsets only on error paths, avoiding line-index bookkeeping during normal compilation. */
    function posToLineCol(src, pos) {
        let line = 1, col = 1;
        for (let i = 0; i < pos; i++) {
            if (src.charCodeAt(i) === 10) { line++; col = 1; }
            else { col++; }
        }
        return { line, col };
    }

    /** Builds source-oriented diagnostics so parser errors reference the original template, not generated code. */
    function codeFrame(src, pos, len = 1) {
        const { line, col } = posToLineCol(src, pos);
        const lines = src.split(/\n/);
        const i = line - 1;
        const pad = (n) => String(n).padStart(4, " ");
        const caret = " ".repeat(col - 1) + "^".repeat(Math.max(1, len));
        const ctx = [
            lines[i - 1] != null ? `${pad(line - 1)} | ${lines[i - 1]}` : null,
            `${pad(line)} | ${lines[i]}`,
            `     | ${caret}`,
            lines[i + 1] != null ? `${pad(line + 1)} | ${lines[i + 1]}` : null
        ].filter(Boolean).join("\n");
        return { line, col, frame: ctx };
    }


    // ---------------------------------------------------------------------------
    // Unified scope factory for STRICT and LOOSE modes
    // ---------------------------------------------------------------------------
    /**
     * Builds the compatibility Proxy used only when native `with` lookup cannot reproduce TinyT semantics.
     * Normal rendering avoids Proxy because it is materially slower; diagnostics, historical falsey roots and
     * strict objects exposing Symbol.unscopables deliberately retain the compatibility path.
     */
    function makeScope(data, extraAllowed /* Set|null */, missingSink /* Set|null */, emptyBase, hasIndex) {
        const isBoxedPrimitive = !!data && typeof data !== "object" && typeof data !== "function";
        const base = !data
            ? emptyBase
            : (isBoxedPrimitive ? Object(data) : data);
        const isStrict = !!extraAllowed;

        return new Proxy(base, {
            has(_, key) {
                if (typeof key === "symbol") return false;
                if (key in base) return true;

                // Keep compiler/runtime internals lexical instead of resolving them through data.
                if (key === "__result__" || key === "apiLocal" || key === "opts" ||
                    key === "__EMPTY" || key === "__index" || key === "__hasIndex" ||
                    (key === "$index" && hasIndex) ||
                    (isStrict && extraAllowed.has(key))) return false;

                if (key in globalThis) return true;

                if (missingSink) {
                    missingSink.add(key);
                    // Intentionally retained: useful development diagnostics.
                    console.debug(`[TinyT] Missing identifier "${key}" — ignored`);
                    return true;
                }
                return isStrict ? false : true;
            },

            get(_, key) {
                if (typeof key === "symbol") return undefined;
                if (key in base) {
                    const value = base[key];
                    return isBoxedPrimitive && typeof value === "function" ? value.bind(base) : value;
                }
                if (isStrict && extraAllowed.has(key)) return undefined;
                if (key in globalThis) return globalThis[key];
                return undefined;
            },

            getPrototypeOf() { return null; }
        });
    }

    // ---------------------------------------------------------------------------
    // Compiler: template string → (data, opts) => html (with caching)
    // ---------------------------------------------------------------------------
    /**
     * Compiles a template to native JavaScript and caches separate loose/strict renderers.
     * Work is intentionally front-loaded so repeated renders execute direct JS branches and loops instead
     * of interpreting template tokens at runtime.
     */
    function compile(tpl, compileOpts) {
        if (typeof tpl !== "string") throw new TypeError("compile: template must be a string");

        const strict = !!compileOpts?.strict;
        const activeCache = strict ? strictCache : looseCache;
        const cached = activeCache.get(tpl);
        if (cached) return cached;

        let i = 0;
        const N = tpl.length;
        let code = "let out = ``;\n";
        const blockStack = [];
        const allowedNames = new Set();

        const pushText = (text) => { if (text) code += `out += \`${esc(text)}\`;\n`; };
        const pushError = (msg, pos, len = 2) => {
            const cf = codeFrame(tpl, pos, len);
            throw new SyntaxError(`${msg} at ${cf.line}:${cf.col}\n${cf.frame}`);
        };

        while (i < N) {
            const j1 = tpl.indexOf("{{", i);
            const j2 = tpl.indexOf("${", i);
            const j = (j1 === -1 ? j2 : j2 === -1 ? j1 : Math.min(j1, j2));
            if (j === -1) { pushText(tpl.slice(i)); break; }
            pushText(tpl.slice(i, j));

            if (tpl.startsWith("${", j)) {
                const end = findJavaScriptEnd(tpl, j + 2, "expression");
                if (end < 0) pushError("Unclosed `${...}`", j, 2);
                const expression = tpl.slice(j + 2, end).trim();
                code += `out += ((${expression}) ?? "");\n`;
                i = end + 1;
                continue;
            }

            const end = findJavaScriptEnd(tpl, j + 2, "directive");
            if (end < 0) pushError("Unclosed `{{...}}`", j, 2);
            const insideRaw = tpl.slice(j + 2, end);
            const inside = insideRaw.trim();
            const directivePos = j;
            i = end + 2;

            if (inside.startsWith("html ")) {
                const expr = inside.slice(5).trim();
                code += `out += ((${expr}) ?? "");\n`;
                continue;
            }

            if (inside.startsWith("if ")) {
                code += `if (${inside.slice(3).trim()}) {\n`;
                blockStack.push({ type: "if", pos: directivePos });
                continue;
            }
            if (inside.startsWith("elsif ")) {
                if (!blockStack.length || blockStack[blockStack.length - 1].type !== "if")
                    pushError("`{{elsif}}` without matching `{{if}}`", directivePos);
                code += `} else if (${inside.slice(6).trim()}) {\n`;
                continue;
            }
            if (inside === "else") {
                if (!blockStack.length || blockStack[blockStack.length - 1].type !== "if")
                    pushError("`{{else}}` without matching `{{if}}`", directivePos);
                code += `} else {\n`;
                continue;
            }
            if (inside === "/if") {
                if (!blockStack.length || blockStack.pop().type !== "if")
                    pushError("`{{/if}}` without matching `{{if}}`", directivePos);
                code += `}\n`;
                continue;
            }

            if (inside.startsWith("each ")) {
                const spec = inside.slice(5).trim();
                let expr = spec, vName = "$value", indexAlias = null;
                const asIdx = findTopLevelEachAs(spec);
                if (asIdx !== -1) {
                    expr = spec.slice(0, asIdx).trim();
                    const vars = spec.slice(asIdx + 2).trim().split(",").map(s => s.trim()).filter(Boolean);
                    if (vars.length > 2) pushError("`{{each}}` accepts at most value and index aliases", directivePos);
                    if (vars[0]) vName = vars[0];
                    if (vars[1]) indexAlias = vars[1];
                    if (!isValidBindingIdentifier(vName)) pushError(`Invalid each value alias "${vName}"`, directivePos);
                    if (indexAlias && !isValidBindingIdentifier(indexAlias)) pushError(`Invalid each index alias "${indexAlias}"`, directivePos);
                    if (vName === "$index") pushError('`$index` is reserved and cannot be used as the each value alias', directivePos);
                    if (indexAlias && indexAlias === vName) pushError("Each value and index aliases must be different", directivePos);
                }
                const arrVar = `__a${directivePos}`;
                const loopIndexVar = `__i${directivePos}`;
                const indexAliasDeclaration = indexAlias && indexAlias !== "$index" ? `const ${indexAlias} = $index;` : "";

                allowedNames.add(vName);
                allowedNames.add("$index");
                if (indexAlias) allowedNames.add(indexAlias);

                code += `
          const ${arrVar}_src = (${expr});
          const ${arrVar} = ${arrVar}_src == null ? [] :
            (Array.isArray(${arrVar}_src) ? ${arrVar}_src :
             (typeof ${arrVar}_src === 'object' ? Object.values(${arrVar}_src) : []));
          for (let ${loopIndexVar} = 0; ${loopIndexVar} < ${arrVar}.length; ${loopIndexVar}++) {
            const $index = ${loopIndexVar};
            ${indexAliasDeclaration}
            let ${vName} = ${arrVar}[${loopIndexVar}];
            with ( (${vName} && typeof ${vName} === 'object') ? ${vName} : __EMPTY ) {
        `;
                blockStack.push({ type: "each", pos: directivePos });
                continue;
            }
            if (inside === "/each") {
                const blk = blockStack.pop();
                if (!blk || blk.type !== "each")
                    pushError("`{{/each}}` without matching `{{each}}`", directivePos);
                code += `}\n}\n`;
                continue;
            }

            if (inside.startsWith("tmpl")) {
                const m = inside.match(/^tmpl\s*\(([\s\S]+)\)\s+(["'])(#[^"']+)\2$/);
                if (!m) pushError("Bad `{{tmpl(expr) \"#id\"}}` syntax", directivePos);
                const dataExpression = m[1].trim();
                const templateId = normalizeTemplateId(m[3]);
                const renderMethod = strict ? "renderTemplateStrict" : "renderTemplateLoose";
                const inEach = blockStack.some(block => block.type === "each");
                if (inEach) {
                    code += `out += apiLocal.${renderMethod}(${JSON.stringify(templateId)}, (${dataExpression}), opts, $index, true);\n`;
                } else {
                    code += `out += apiLocal.${renderMethod}(${JSON.stringify(templateId)}, (${dataExpression}), opts);\n`;
                }
                continue;
            }

            code += `out += \`${esc("{{" + insideRaw + "}}")}\`;\n`;
        }

        if (blockStack.length) {
            const last = blockStack[blockStack.length - 1];
            pushError(`Unclosed \`{{${last.type}}}\` block`, last.pos);
        }

        code += "__result__ = out;";
        const allowedSet = strict ? new Set(allowedNames) : null;

        const fn = new Function(
            "data",
            "api",
            "opts",
            "__ALLOWED",
            "__EMPTY",
            "__index",
            "__hasIndex",
            `try {
        const __collect = !!opts?.missingToUndefined;
        const __missingSet = __collect ? new Set() : null;
        const apiLocal = api;
        let __result__;
        const __data = data || __EMPTY;
        const __helpers = opts?.helpers;
        const __base = __helpers ? Object.assign(Object.create(__helpers), __data) : __data;

        // Unknown identifiers naturally throw through a plain with-scope.
        // Proxy is only required for collection and for the historical falsey-root case.
        // Strict 3.7.0 ignored Symbol.unscopables because its Proxy hid symbol lookups.
        // Native with-scope honors it, so keep the Proxy only for strict objects that expose it.
        const __hasUnscopables = !!__ALLOWED && data != null &&
          (typeof data === 'object' || typeof data === 'function') &&
          typeof Symbol !== 'undefined' && Symbol.unscopables && (Symbol.unscopables in data);
        const __useProxy = __collect || (!!__ALLOWED && !data && !__helpers) || __hasUnscopables;

        if (__useProxy) {
          const __scopeTarget = __helpers ? __base : data;
          const scope = apiLocal.makeScope(__scopeTarget, __ALLOWED, __missingSet, __EMPTY, __hasIndex);
          if (__hasIndex) {
            const $index = __index;
            with (scope) { ${code} }
          } else {
            with (scope) { ${code} }
          }
        } else if (__hasIndex) {
          const $index = __index;
          with (__base || __EMPTY) { ${code} }
        } else {
          with (__base || __EMPTY) { ${code} }
        }

        if (__missingSet) {
          const __arr = Array.from(__missingSet);
          if (__arr.length > 0 && typeof opts?.onMissing === "function") {
            try { opts.onMissing(__arr); } catch (_) {}
          }
          if (opts) opts._lastMissing = __arr;
        }

        return __result__;
      } catch (e) {
        console.log(e);
        throw e;
      }`
        );

        /** Executes generated code for one value or an array without callback/intermediate-array allocations. */
        const compiled = function compiledRenderer(d, opts, __index, __hasIndex) {
            let runtimeOpts = opts || defaultRuntimeOpts;

            // Explicit per-render values win. Global values are copied only when a caller supplied
            // some other runtime options and left one of the configured defaults undefined. This
            // keeps the default production path allocation-free and makes already-compiled renderers
            // observe later configure() changes.
            if (opts) {
                const inheritMissingMode =
                    opts.missingToUndefined === undefined && defaults.missingToUndefined;
                const effectiveMissingMode = opts.missingToUndefined === undefined
                    ? defaults.missingToUndefined
                    : !!opts.missingToUndefined;
                const inheritOnMissing = effectiveMissingMode &&
                    opts.onMissing === undefined && defaults.onMissing !== null;

                if (inheritMissingMode || inheritOnMissing) {
                    runtimeOpts = Object.assign({}, opts);
                    if (inheritMissingMode) runtimeOpts.missingToUndefined = true;
                    if (inheritOnMissing) runtimeOpts.onMissing = defaults.onMissing;
                }
            }

            if (!Array.isArray(d)) {
                return fn(d, RUNTIME_API, runtimeOpts, allowedSet, EMPTY_OBJ, __index, !!__hasIndex);
            }

            const transform = typeof runtimeOpts.rowTransform === "function" ? runtimeOpts.rowTransform : null;
            let output = "";
            for (let index = 0; index < d.length; index++) {
                const row = d[index];
                const transformedRow = transform ? transform(row, index) : row;
                output += fn(
                    transformedRow === undefined ? row : transformedRow,
                    RUNTIME_API,
                    runtimeOpts,
                    allowedSet,
                    EMPTY_OBJ,
                    undefined,
                    false
                );
            }
            return output;
        };

        activeCache.set(tpl, compiled);
        return compiled;
    }

    const LOOSE_COMPILE_OPTS = Object.freeze({ strict: false });
    const STRICT_COMPILE_OPTS = Object.freeze({ strict: true });

    /** Reuses renderer references stored beside registered source to avoid repeated cache/source resolution. */
    function getTemplateRendererNormalized(id, strict) {
        const entry = getTemplateEntryNormalized(id);
        let renderer = strict ? entry.strict : entry.loose;
        if (!renderer) {
            renderer = compile(entry.source, strict ? STRICT_COMPILE_OPTS : LOOSE_COMPILE_OPTS);
            if (strict) entry.strict = renderer;
            else entry.loose = renderer;
        }
        return renderer;
    }

    /** Public-id wrapper; generated nested-template code calls the cheaper normalized variant directly. */
    function getTemplateRenderer(id, strict) {
        return getTemplateRendererNormalized(normalizeTemplateId(id), strict);
    }

    // Shared runtime API: no per-render object or closure allocation.
    const RUNTIME_API = Object.freeze({
        makeScope,
        /** Renders a normalized child id without cloning child data merely to propagate `$index`. */
        renderTemplateLoose(id, data, opts, index, hasIndex) {
            const entry = getTemplateEntryNormalized(id);
            let renderer = entry.loose;
            if (!renderer) {
                renderer = compile(entry.source, LOOSE_COMPILE_OPTS);
                entry.loose = renderer;
            }
            return hasIndex
                ? renderer(data, opts, index, true)
                : renderer(data, opts);
        },
        /** Strict child counterpart kept separate so generated code pays no per-call mode branch. */
        renderTemplateStrict(id, data, opts, index, hasIndex) {
            const entry = getTemplateEntryNormalized(id);
            let renderer = entry.strict;
            if (!renderer) {
                renderer = compile(entry.source, STRICT_COMPILE_OPTS);
                entry.strict = renderer;
            }
            return hasIndex
                ? renderer(data, opts, index, true)
                : renderer(data, opts);
        }
    });

    // ---------------------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------------------

    /** Cheaply detects edge whitespace so common `render()` inputs can bypass `trim()` allocation/work. */
    function isEcmaTrimWhitespaceCode(code) {
        return code <= 0x20 || code === 0xA0 || code === 0x1680 ||
            (code >= 0x2000 && code <= 0x200A) || code === 0x2028 ||
            code === 0x2029 || code === 0x202F || code === 0x205F ||
            code === 0x3000 || code === 0xFEFF;
    }

    /** Renders raw source or `#id`, using fast paths while preserving whitespace-padded legacy ids. */
    function render(tpl, data, opts) {
        if (typeof tpl !== "string") {
            throw new Error("render: template must be a string (raw template or '#id').");
        }
        if (tpl.charCodeAt(0) === 35) {
            const strict = !!opts?.strict;
            const lastCode = tpl.charCodeAt(tpl.length - 1);
            if (!isEcmaTrimWhitespaceCode(lastCode)) {
                return getTemplateRendererNormalized(tpl.slice(1), strict)(data, opts);
            }
        } else if (tpl.length > 0 && !isEcmaTrimWhitespaceCode(tpl.charCodeAt(0))) {
            return compile(tpl, opts)(data, opts);
        }

        const trimmed = tpl.trim();
        if (trimmed.startsWith("#")) {
            const strict = !!opts?.strict;
            return getTemplateRendererNormalized(trimmed.slice(1), strict)(data, opts);
        }
        return compile(tpl, opts)(data, opts);
    }

    /** Keeps DOM mutation separate from string rendering so the core remains usable outside browsers. */
    function renderTo(elOrId, tplOrIdOrString, data, opts) {
        let el;
        if (typeof elOrId === "string") {
            const id = elOrId.startsWith("#") ? elOrId.slice(1) : elOrId;
            el = document.getElementById(id);
            if (!el) throw new Error(`renderTo: element "${elOrId}" not found`);
        } else if (elOrId && elOrId.nodeType === 1) {
            el = elOrId;
        } else {
            throw new Error("renderTo: first argument must be an element or an element id string");
        }
        const html = render(tplOrIdOrString, data, opts);
        el.innerHTML = html;
        return html;
    }

    /**
     * Compiles a named map transactionally, then registers it only after every template succeeds.
     * Plain compile-time helper maps are reused when safe so unrelated runtime options do not trigger
     * expensive helper-map copies; unusual accessor/prototype maps preserve historical copy semantics.
     */
    function compileTemplateMap(defs, opts = { strict: true }) {
        if (!defs || typeof defs !== "object" || Array.isArray(defs)) {
            throw new TypeError("compileTemplateMap: expected an object mapping { id: templateString }");
        }

        const renderers = {};
        const compileOpts = opts || {};
        const { helpers: compileHelpers, ...compileOptsRest } = compileOpts;
        const compileHelpersProto = compileHelpers && Object.getPrototypeOf(compileHelpers);
        const compileHelperDescriptors = compileHelpers && Object.getOwnPropertyDescriptors(compileHelpers);
        const canBindHelpersDirectly = !!compileHelpers &&
            compileHelpersProto === Object.prototype &&
            Object.values(compileHelperDescriptors).every(descriptor =>
                !descriptor.get && !descriptor.set && descriptor.enumerable
            );

        // Fast-path options are built once. Plain helper maps can be referenced
        // directly without changing normal lookup semantics; unusual helper maps
        // (accessors/custom prototypes) keep the 3.6.x copy-on-render behavior.
        const boundOpts = Object.assign({}, compileOptsRest);
        if (canBindHelpersDirectly) boundOpts.helpers = compileHelpers;

        // Compile everything before touching the registry. A bad template must not leave
        // half a map installed or replace a previously working registered template.
        const pending = [];
        for (const [id, tpl] of Object.entries(defs)) {
            try {
                if (!id.trim()) throw new TypeError(`Invalid template id: ${String(id)}`);
                if (typeof tpl !== "string") throw new TypeError(`Template "${id}" must be a string`);
                pending.push({ id, tpl, compiled: compile(tpl, compileOpts) });
            } catch (e) {
                throw new AggregateError(
                    [e],
                    `Template "${id}" failed to register/compile: ${e.message}`
                );
            }
        }

        for (const { id, tpl, compiled } of pending) {
            registerTemplate(id, tpl);
            const entry = getTemplateEntry(id);
            entry[compileOpts.strict ? "strict" : "loose"] = compiled;

            /** Applies compile-time defaults while keeping the no-override path allocation-light. */
            renderers[id] = function boundRenderer(data, callOpts) {
                if (callOpts == null && (!compileHelpers || canBindHelpersDirectly)) {
                    return compiled(data, boundOpts);
                }

                const runtimeCallOpts = callOpts || EMPTY_OBJ;
                const callHelpers = runtimeCallOpts.helpers;
                const finalOpts = Object.assign({}, compileOptsRest, runtimeCallOpts);
                if (callHelpers) {
                    finalOpts.helpers = Object.assign({}, compileHelpers || EMPTY_OBJ, callHelpers);
                } else if (compileHelpers) {
                    // Plain helper maps already use direct binding on the no-options fast path.
                    // Reuse the same map when only unrelated runtime options are overridden.
                    finalOpts.helpers = canBindHelpersDirectly
                        ? compileHelpers
                        : Object.assign({}, compileHelpers);
                } else {
                    delete finalOpts.helpers;
                }
                return compiled(data, finalOpts);
            };
        }

        return renderers;
    }

    return {
        configure,
        registerTemplate,
        getTemplate,
        compile,
        render,
        renderTo,
        compileTemplateMap,
        clearCache,
        cacheSize
    };
})();

// ---------------------------------------------------------------------------
// Optional jQuery integration
// ---------------------------------------------------------------------------
if (typeof jQuery !== "undefined" && jQuery.fn) (function($, TinyT) {
    /** jQuery adapter: missing-variable mode and callback both inherit TinyT.configure(). */
    $.tmpl = function (element, data, strict = false) {
        const opts = { strict };

        if (!element) return $();

        let nodes = [];
        if (element.jquery)
            nodes = element.toArray();
        else if (typeof element === 'string' || element.nodeType === 1)
            nodes = [element];
        else
            throw new Error('[TinyT] $.tmpl: invalid "element". Expected a jQuery object, a DOM Element, or a string (selector/HTML). Received: ' + (element === null ? 'null' : typeof element));

        const inserted = [];
        for (const el of nodes) {
            const tpl = (typeof el === 'string') ? el.trim() : el.outerHTML;
            const rendered = TinyT.render(tpl, data, opts);
            inserted.push(rendered);
        }

        return $(inserted);
    };

    /** Keeps the historical next-frame callback timing after synchronous DOM replacement. */
    $.fn.tmplTo = function(template_alias, data, callback, strict = false) {
        try {
            TinyT.renderTo(this[0], '#' + template_alias, data, { strict: strict });
            if (typeof callback === 'function') {
                requestAnimationFrame(() => {
                    callback(this);
                });
            }
        } catch (e) {
            console.error(e.message);
        }
        return this;
    };
})(jQuery, TinyT);
