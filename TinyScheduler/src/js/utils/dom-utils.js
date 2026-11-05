/**
 * DOM helpers
 * -----------
 * Small dependency-free helpers shared by calendar classes and views.
 *
 * The main helper, createDomElement(), keeps element creation consistent and
 * avoids repeating dataset/style/attribute handling across the project.
 */

/**
 * Remove all children from an element.
 *
 * @param {HTMLElement|null} element - Element to empty.
 * @returns {HTMLElement|null}
 */
function emptyElement(element) {
  if (element) element.innerHTML = '';
  return element;
}

/**
 * Safely append text, one node or an array of mixed children.
 *
 * @param {HTMLElement} element - Target element.
 * @param {*} content - Node, text, number, array, null or undefined.
 * @returns {HTMLElement}
 */
function appendDomContent(element, content) {
  if (content == null || content === '') return element;

  if (Array.isArray(content)) {
    content.forEach(child => appendDomContent(element, child));
    return element;
  }

  if (content instanceof Node) {
    element.append(content);
    return element;
  }

  element.append(document.createTextNode(String(content)));
  return element;
}

/**
 * Apply dataset values, skipping null/undefined values.
 *
 * @param {HTMLElement} element - Target element.
 * @param {Object} values - Dataset key/value pairs.
 * @returns {HTMLElement}
 */
function setDataset(element, values = {}) {
  Object.entries(values || {}).forEach(([key, value]) => {
    if (!isNil(value)) element.dataset[key] = String(value);
  });

  return element;
}

/**
 * Apply style values, supporting CSS custom properties.
 *
 * @param {HTMLElement} element - Target element.
 * @param {Object} values - Style key/value pairs.
 * @returns {HTMLElement}
 */
function setStyles(element, values = {}) {
  Object.entries(values || {}).forEach(([key, value]) => {
    if (isNil(value)) return;

    if (key.startsWith('--')) {
      element.style.setProperty(key, String(value));
      return;
    }

    element.style[key] = String(value);
  });

  return element;
}

/**
 * Apply HTML attributes, skipping null/undefined/false values.
 * Boolean true creates a boolean attribute.
 *
 * @param {HTMLElement} element - Target element.
 * @param {Object} values - Attribute key/value pairs.
 * @returns {HTMLElement}
 */
function setAttributes(element, values = {}) {
  Object.entries(values || {}).forEach(([key, value]) => {
    if (isNil(value) || value === false) return;
    element.setAttribute(key, value === true ? '' : String(value));
  });

  return element;
}

/**
 * Apply common element options.
 *
 * @param {HTMLElement} element - Target element.
 * @param {Object} options - DOM options.
 * @param {Object} options.props - DOM properties.
 * @param {Object} options.attrs - HTML attributes.
 * @param {Object} options.dataset - Dataset values.
 * @param {Object} options.style - Inline styles or CSS variables.
 * @param {string} options.html - Explicit trusted HTML.
 * @param {Array<Node|string|number>} options.children - Extra children.
 * @returns {HTMLElement}
 */
function applyDomOptions(element, options = {}) {
  const { props, attrs, dataset, style, html, children } = options || {};

  // Inner HTML is intentionally explicit. Use it only for trusted markup such
  // as static SVG icons owned by the component.
  if (html != null) element.innerHTML = html;
  if (props) Object.assign(element, props);
  if (attrs) setAttributes(element, attrs);
  if (dataset) setDataset(element, dataset);
  if (style) setStyles(element, style);
  if (Array.isArray(children)) appendDomContent(element, children);

  return element;
}

/**
 * Create a DOM element with consistent content/options handling.
 *
 * @param {string} tagName - HTML tag name.
 * @param {string} className - Optional class string.
 * @param {string|number|Node|Array<Node|string|number>} content - Text or children.
 * @param {Object} options - DOM options.
 * @returns {HTMLElement}
 */
function createDomElement(tagName, className = '', content = '', options = {}) {
  const element = document.createElement(tagName);
  if (className) element.className = className
  appendDomContent(element, content);
  applyDomOptions(element, options);
  return element;
}
