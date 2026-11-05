(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['TinySelectize'], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./TinySelectize'));
    } else {
        factory(root.TinySelectize);
    }
}(typeof self !== 'undefined' ? self : this, function (TinySelectize) {
    'use strict';

    const CLASS_NAMES = Object.freeze({
        TREE: 'tsz--tree',
        OPTION: 'tszTree__option',
        LABEL: 'tszTree__label',
        BADGE: 'tszTree__badge',
        PARENT: 'is-parent',
        LEAF: 'is-leaf'
    });

    const DEFAULT_OPTIONS = Object.freeze({
        parentField: 'parentId',
        childrenField: 'children',
        valueField: 'id',
        labelField: 'label',
        sort: 'id',
        sortDirection: 'asc',
        onlyLeavesSelectable: false,
        showChildCount: true,
        indentPx: 16
    });

    function isFn(value) {
        return typeof value === 'function';
    }

    function isObj(value) {
        return value !== null && typeof value === 'object';
    }

    if (!TinySelectize || !isFn(TinySelectize.definePlugin)) {
        throw new Error('TinySelectize tree plugin requires TinySelectize.');
    }

    function toStr(value) {
        return value == null ? '' : String(value);
    }

    function getRaw(option) {
        return isObj(option && option.raw) ? option.raw : option;
    }

    function getField(option, fieldName) {
        if (!fieldName) return undefined;

        const raw = getRaw(option);
        if (isObj(raw) && raw[fieldName] != null) return raw[fieldName];
        if (isObj(option) && option[fieldName] != null) return option[fieldName];
        return undefined;
    }

    function comparePrimitive(left, right) {
        const leftNumber = Number(left);
        const rightNumber = Number(right);

        if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
            return leftNumber - rightNumber;
        }

        return toStr(left).localeCompare(toStr(right), undefined, {
            numeric: true,
            sensitivity: 'base'
        });
    }

    TinySelectize.definePlugin('tree', function (pluginOptions) {
        const settings = Object.assign(
            {},
            DEFAULT_OPTIONS,
            isObj(pluginOptions) ? pluginOptions : {}
        );

        let instance = null;

        function getNodeValue(option) {
            const configuredValue = getField(option, settings.valueField);
            return toStr(configuredValue != null ? configuredValue : option.value);
        }

        function getNodeLabel(option) {
            const configuredLabel = getField(option, settings.labelField);
            return toStr(configuredLabel != null ? configuredLabel : option.label);
        }

        function getParentValue(option) {
            const parentValue = getField(option, settings.parentField);
            return parentValue == null || parentValue === ''
                ? ''
                : toStr(parentValue);
        }

        function createOptionFromRaw(raw, parentValue) {
            const value = toStr(raw && raw[settings.valueField]);
            if (!value) return null;

            const normalizedRaw = Object.assign({}, raw);
            if (
                parentValue &&
                normalizedRaw[settings.parentField] == null
            ) {
                normalizedRaw[settings.parentField] = parentValue;
            }

            return {
                value,
                label: toStr(
                    normalizedRaw[settings.labelField] != null
                        ? normalizedRaw[settings.labelField]
                        : value
                ),
                disabled: normalizedRaw.disabled === true,
                raw: normalizedRaw
            };
        }

        function collectNestedOptions(options) {
            const collected = Array.isArray(options) ? options.slice() : [];
            const knownValues = new Set();

            for (let index = 0; index < collected.length; index++) {
                knownValues.add(getNodeValue(collected[index]));
            }

            function visitChildren(raw, parentValue) {
                const children = isObj(raw) && Array.isArray(raw[settings.childrenField])
                    ? raw[settings.childrenField]
                    : [];

                for (let index = 0; index < children.length; index++) {
                    const childRaw = children[index];
                    const childOption = createOptionFromRaw(childRaw, parentValue);
                    if (!childOption) continue;

                    if (!knownValues.has(childOption.value)) {
                        knownValues.add(childOption.value);
                        collected.push(childOption);
                    }

                    visitChildren(childRaw, childOption.value);
                }
            }

            for (let index = 0; index < options.length; index++) {
                const option = options[index];
                visitChildren(getRaw(option), getNodeValue(option));
            }

            return collected;
        }

        function createComparator(context) {
            const direction = settings.sortDirection === 'desc' ? -1 : 1;

            if (isFn(settings.sort)) {
                return function (leftNode, rightNode) {
                    return direction * Number(
                        settings.sort(leftNode.option, rightNode.option, context) || 0
                    );
                };
            }

            return function (leftNode, rightNode) {
                const leftValue = settings.sort === 'label'
                    ? getNodeLabel(leftNode.option)
                    : getField(leftNode.option, settings.valueField) ?? leftNode.value;
                const rightValue = settings.sort === 'label'
                    ? getNodeLabel(rightNode.option)
                    : getField(rightNode.option, settings.valueField) ?? rightNode.value;

                return direction * comparePrimitive(leftValue, rightValue);
            };
        }

        function flattenTree(options, context) {
            const sourceOptions = collectNestedOptions(
                Array.isArray(options) ? options : []
            );
            const nodeByValue = new Map();
            const nodes = [];

            for (let index = 0; index < sourceOptions.length; index++) {
                const option = sourceOptions[index];
                const value = getNodeValue(option);
                if (!value || nodeByValue.has(value)) continue;

                const node = {
                    value,
                    parentValue: getParentValue(option),
                    option,
                    children: [],
                    sourceIndex: index
                };

                nodeByValue.set(value, node);
                nodes.push(node);
            }

            const roots = [];

            for (let index = 0; index < nodes.length; index++) {
                const node = nodes[index];
                const parentNode = nodeByValue.get(node.parentValue);

                if (parentNode && parentNode !== node) {
                    parentNode.children.push(node);
                } else {
                    roots.push(node);
                }
            }

            const compareNodes = createComparator(context);
            roots.sort(compareNodes);
            for (let index = 0; index < nodes.length; index++) {
                nodes[index].children.sort(compareNodes);
            }

            const flattened = [];
            const visited = new Set();
            const visiting = new Set();

            function visit(node, depth, path) {
                if (visited.has(node.value) || visiting.has(node.value)) return;

                visiting.add(node.value);

                const childCount = node.children.length;
                const isLeaf = childCount === 0;
                const label = getNodeLabel(node.option);
                const nextPath = path.concat(label);
                const existingMeta = isObj(node.option._meta)
                    ? node.option._meta
                    : {};

                flattened.push(Object.assign({}, node.option, {
                    disabled: node.option.disabled === true ||
                        (settings.onlyLeavesSelectable && !isLeaf),
                    _meta: Object.assign({}, existingMeta, {
                        tree: {
                            depth,
                            path: nextPath,
                            isLeaf,
                            childCount,
                            parentValue: node.parentValue
                        }
                    })
                }));

                for (let index = 0; index < node.children.length; index++) {
                    visit(node.children[index], depth + 1, nextPath);
                }

                visiting.delete(node.value);
                visited.add(node.value);
            }

            for (let index = 0; index < roots.length; index++) {
                visit(roots[index], 0, []);
            }

            // Cycles have no natural root. Render each remaining node once
            // instead of dropping data or recursing indefinitely.
            for (let index = 0; index < nodes.length; index++) {
                if (!visited.has(nodes[index].value)) {
                    visit(nodes[index], 0, []);
                }
            }

            return flattened;
        }

        function renderTreeRow(row, option) {
            const treeMeta = option && option._meta && option._meta.tree;
            if (!isObj(treeMeta)) return;

            const depth = Math.max(0, Number(treeMeta.depth) || 0);
            const childCount = Math.max(0, Number(treeMeta.childCount) || 0);
            const isLeaf = treeMeta.isLeaf === true;

            row.dataset.depth = String(depth);
            row.style.setProperty('--depth', String(depth));
            row.classList.toggle(CLASS_NAMES.PARENT, !isLeaf);
            row.classList.toggle(CLASS_NAMES.LEAF, isLeaf);
            row.setAttribute('aria-level', String(depth + 1));

            const content = document.createElement('span');
            content.className = CLASS_NAMES.OPTION;

            const label = document.createElement('span');
            label.className = CLASS_NAMES.LABEL;

            while (row.firstChild) {
                label.appendChild(row.firstChild);
            }

            content.appendChild(label);

            if (settings.showChildCount && childCount > 0) {
                const badge = document.createElement('span');
                badge.className = CLASS_NAMES.BADGE;
                badge.textContent = String(childCount);
                badge.setAttribute(
                    'aria-label',
                    childCount + (childCount === 1 ? ' child' : ' children')
                );
                content.appendChild(badge);
            }

            row.appendChild(content);
        }

        return {
            name: 'tree',

            onInit(selectize) {
                instance = selectize;
                instance.wrapper.classList.add(CLASS_NAMES.TREE);
                instance.dropdown.classList.add(CLASS_NAMES.TREE);

                const indent = Number(settings.indentPx);
                if (Number.isFinite(indent) && indent > 0) {
                    instance.dropdown.style.setProperty(
                        '--tsz-tree-indent',
                        indent + 'px'
                    );
                }
            },

            transformOptions(options, context) {
                return flattenTree(options, context);
            },

            decorateRenderArgs(args) {
                const treeMeta = args && args.meta && args.meta.tree;
                if (isObj(treeMeta)) {
                    args.tree = treeMeta;
                }
                return args;
            },

            onOptionRow(row, option) {
                renderTreeRow(row, option);
            },

            onDestroy() {
                if (!instance) return;
                instance.wrapper.classList.remove(CLASS_NAMES.TREE);
                instance.dropdown.classList.remove(CLASS_NAMES.TREE);
                instance.dropdown.style.removeProperty('--tsz-tree-indent');
                instance = null;
            }
        };
    });

    return TinySelectize;
}));
