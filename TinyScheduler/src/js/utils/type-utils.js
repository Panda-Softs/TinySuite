function isFn(value) {
  return typeof value === 'function';
}

function isStr(value) {
  return typeof value === 'string';
}

function isObj(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function isNil(value) {
  return value === null || value === undefined;
}

function noop() {}

function classNames(...names) {
  return names.filter(Boolean).join(' ');
}

function mergeDeep(target, ...sources) {
  const safeTarget = target || {};
  const output = isObj(safeTarget) ? { ...safeTarget } : {};

  sources.forEach(source => {
    if (!isObj(source)) return;

    Object.keys(source).forEach(key => {
      const sourceValue = source[key];
      const targetValue = output[key];

      if (isObj(sourceValue) && isObj(targetValue)) {
        output[key] = mergeDeep(targetValue, sourceValue);
        return;
      }

      // Important:
      // Arrays, Date, functions, null, strings, numbers, booleans
      // must replace the previous value, not be deep-merged.
      output[key] = sourceValue;
    });
  });

  return output;
}
