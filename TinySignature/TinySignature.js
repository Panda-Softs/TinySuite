/*
 * TinySignature v1.0.0
 * Standalone ES6 UMD signature component for HTML canvas.
 *
 * The smoothing and variable-width Bézier drawing algorithm is based on the
 * classic signature_pad approach, adapted here into one pure JavaScript file.
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TinySignature = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Limit how often a hot function runs.
   * Used for pointer/touch move events to reduce rendering work.
   *
   * @param {Function} callback Function to throttle.
   * @param {number} wait Delay in milliseconds.
   * @returns {Function} Throttled function.
   */
  function throttle(callback, wait = 250) {
    let previous = 0;
    let timeout = null;
    let result;
    let storedContext;
    let storedArgs = [];

    const later = () => {
      previous = Date.now();
      timeout = null;
      result = callback.apply(storedContext, storedArgs);

      if (!timeout) {
        storedContext = null;
        storedArgs = [];
      }
    };

    return function throttledFunction(...args) {
      const now = Date.now();
      const remaining = wait - (now - previous);

      storedContext = this;
      storedArgs = args;

      if (remaining <= 0 || remaining > wait) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }

        previous = now;
        result = callback.apply(storedContext, storedArgs);

        if (!timeout) {
          storedContext = null;
          storedArgs = [];
        }
      } else if (!timeout) {
        timeout = setTimeout(later, remaining);
      }

      return result;
    };
  }

  /**
   * One captured point in canvas CSS-pixel coordinates.
   *
   * @param {number} x Horizontal coordinate.
   * @param {number} y Vertical coordinate.
   * @param {number} [pressure=0] Pointer pressure where supported.
   * @param {number} [time=Date.now()] Capture timestamp.
   */
  class Point {
    constructor(x, y, pressure = 0, time = Date.now()) {
      if (Number.isNaN(x) || Number.isNaN(y)) {
        throw new Error(`Point is invalid: (${x}, ${y})`);
      }

      this.x = Number(x);
      this.y = Number(y);
      this.pressure = pressure || 0;
      this.time = time || Date.now();
    }

    /**
     * @param {{x:number,y:number}} start Start point.
     * @returns {number} Euclidean distance to the start point.
     */
    distanceTo(start) {
      return Math.sqrt(
        Math.pow(this.x - start.x, 2) + Math.pow(this.y - start.y, 2),
      );
    }

    /**
     * @param {{x:number,y:number,pressure:number,time:number}} other Compared point.
     * @returns {boolean} True when all point values are identical.
     */
    equals(other) {
      return (
        this.x === other.x &&
        this.y === other.y &&
        this.pressure === other.pressure &&
        this.time === other.time
      );
    }

    /**
     * @param {{x:number,y:number,time:number}} start Previous point.
     * @returns {number} Movement speed in pixels per millisecond.
     */
    velocityFrom(start) {
      return this.time !== start.time ? this.distanceTo(start) / (this.time - start.time) : 0;
    }
  }

  /**
   * Cubic Bézier curve used to render smooth strokes.
   */
  class Bezier {
    /**
     * Build a curve from four points and calculated line widths.
     *
     * @param {Point[]} points Four latest points.
     * @param {{start:number,end:number}} widths Start and end stroke widths.
     * @returns {Bezier} Smooth curve segment.
     */
    static fromPoints(points, widths) {
      const control2 = Bezier.calculateControlPoints(points[0], points[1], points[2]).control2;
      const control1 = Bezier.calculateControlPoints(points[1], points[2], points[3]).control1;

      return new Bezier(points[1], control2, control1, points[2], widths.start, widths.end);
    }

    /**
     * Calculate control points for cubic Bézier interpolation.
     *
     * @param {{x:number,y:number}} startPoint First point.
     * @param {{x:number,y:number}} middlePoint Middle point.
     * @param {{x:number,y:number}} endPoint Last point.
     * @returns {{control1:Point,control2:Point}} Control points.
     */
    static calculateControlPoints(startPoint, middlePoint, endPoint) {
      const dx1 = startPoint.x - middlePoint.x;
      const dy1 = startPoint.y - middlePoint.y;
      const dx2 = middlePoint.x - endPoint.x;
      const dy2 = middlePoint.y - endPoint.y;

      const midpoint1 = {
        x: (startPoint.x + middlePoint.x) / 2,
        y: (startPoint.y + middlePoint.y) / 2,
      };
      const midpoint2 = {
        x: (middlePoint.x + endPoint.x) / 2,
        y: (middlePoint.y + endPoint.y) / 2,
      };

      const length1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
      const length2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
      const midpointDeltaX = midpoint1.x - midpoint2.x;
      const midpointDeltaY = midpoint1.y - midpoint2.y;
      const ratio = length1 + length2 === 0 ? 0 : length2 / (length1 + length2);
      const center = {
        x: midpoint2.x + midpointDeltaX * ratio,
        y: midpoint2.y + midpointDeltaY * ratio,
      };
      const translateX = middlePoint.x - center.x;
      const translateY = middlePoint.y - center.y;

      return {
        control1: new Point(midpoint1.x + translateX, midpoint1.y + translateY),
        control2: new Point(midpoint2.x + translateX, midpoint2.y + translateY),
      };
    }

    /**
     * @param {Point} startPoint Start point.
     * @param {{x:number,y:number}} control2 Second control point.
     * @param {{x:number,y:number}} control1 First control point.
     * @param {Point} endPoint End point.
     * @param {number} startWidth Start stroke width.
     * @param {number} endWidth End stroke width.
     */
    constructor(startPoint, control2, control1, endPoint, startWidth, endWidth) {
      this.startPoint = startPoint;
      this.control2 = control2;
      this.control1 = control1;
      this.endPoint = endPoint;
      this.startWidth = startWidth;
      this.endWidth = endWidth;
    }

    /**
     * Approximate the curve length. More exact length would be slower and unnecessary for drawing.
     *
     * @returns {number} Approximate pixel length.
     */
    length() {
      const steps = 10;
      let length = 0;
      let previousX;
      let previousY;

      for (let index = 0; index <= steps; index += 1) {
        const t = index / steps;
        const currentX = this.point(t, this.startPoint.x, this.control1.x, this.control2.x, this.endPoint.x);
        const currentY = this.point(t, this.startPoint.y, this.control1.y, this.control2.y, this.endPoint.y);

        if (index > 0) {
          const xDifference = currentX - previousX;
          const yDifference = currentY - previousY;
          length += Math.sqrt(xDifference * xDifference + yDifference * yDifference);
        }

        previousX = currentX;
        previousY = currentY;
      }

      return length;
    }

    /**
     * Calculate a coordinate on a cubic Bézier curve.
     *
     * @param {number} t Curve progress between 0 and 1.
     * @param {number} start Start coordinate.
     * @param {number} control1 First control coordinate.
     * @param {number} control2 Second control coordinate.
     * @param {number} end End coordinate.
     * @returns {number} Interpolated coordinate.
     */
    point(t, start, control1, control2, end) {
      return (
        start * (1 - t) * (1 - t) * (1 - t) +
        3 * control1 * (1 - t) * (1 - t) * t +
        3 * control2 * (1 - t) * t * t +
        end * t * t * t
      );
    }
  }

  /**
   * Small EventTarget wrapper.
   * Falls back to document on old iOS where EventTarget cannot be constructed.
   */
  class TinySignatureEventTarget {
    constructor() {
      try {
        this._eventTarget = new EventTarget();
      } catch (error) {
        this._eventTarget = document;
      }
    }

    addEventListener(type, listener, options) {
      this._eventTarget.addEventListener(type, listener, options);
    }

    dispatchEvent(event) {
      return this._eventTarget.dispatchEvent(event);
    }

    removeEventListener(type, listener, options) {
      this._eventTarget.removeEventListener(type, listener, options);
    }
  }

  /**
   * Create a browser-compatible CustomEvent.
   *
   * @param {string} eventName Event name.
   * @param {object} options Event options.
   * @returns {CustomEvent} Custom event instance.
   */
  function createCustomEvent(eventName, options = {}) {
    if (typeof CustomEvent === 'function') {
      return new CustomEvent(eventName, options);
    }

    const event = document.createEvent('CustomEvent');
    event.initCustomEvent(
      eventName,
      Boolean(options.bubbles),
      Boolean(options.cancelable),
      options.detail,
    );
    return event;
  }

  /**
   * Clone point groups to avoid external mutation of internal drawing data.
   *
   * @param {Array<object>} pointGroups Signature point groups.
   * @returns {Array<object>} Deep-cloned point groups.
   */
  function clonePointGroups(pointGroups) {
    return pointGroups.map((group) => ({
      penColor: group.penColor,
      dotSize: group.dotSize,
      minWidth: group.minWidth,
      maxWidth: group.maxWidth,
      velocityFilterWeight: group.velocityFilterWeight,
      compositeOperation: group.compositeOperation,
      points: Array.isArray(group.points)
        ? group.points.map((point) => ({
            x: point.x,
            y: point.y,
            pressure: point.pressure || 0,
            time: point.time || Date.now(),
          }))
        : [],
    }));
  }

  /**
   * Encode SVG safely as a base64 data URL.
   *
   * @param {string} svg SVG markup.
   * @returns {string} Base64 SVG data URL.
   */
  function svgToDataURL(svg) {
    const encodedSvg = encodeURIComponent(svg).replace(/%([0-9A-F]{2})/g, (match, code) => {
      return String.fromCharCode(`0x${code}`);
    });

    return `data:image/svg+xml;base64,${btoa(encodedSvg)}`;
  }

  /**
   * Convert a data URL into a Blob.
   * Useful for downloads and integrations that expect a file-like object.
   *
   * @param {string} dataURL Source data URL.
   * @returns {Blob} Blob with the proper MIME type.
   */
  function dataURLToBlob(dataURL) {
    const parts = dataURL.split(';base64,');
    const contentType = parts[0].split(':')[1];
    const raw = atob(parts[1]);
    const rawLength = raw.length;
    const uint8Array = new Uint8Array(rawLength);

    for (let index = 0; index < rawLength; index += 1) {
      uint8Array[index] = raw.charCodeAt(index);
    }

    return new Blob([uint8Array], { type: contentType });
  }

  /**
   * TinySignature turns a canvas into a fast, smooth signature input.
   *
   * @example
   * const signature = new TinySignature(document.querySelector('canvas'), {
   *   penColor: '#111827',
   *   backgroundColor: '#ffffff'
   * });
   */
  class TinySignature extends TinySignatureEventTarget {
    /**
     * @param {HTMLCanvasElement} canvas Canvas element used for drawing.
     * @param {object} [options={}] Component options.
     * @param {number} [options.dotSize=0] Fixed dot radius. 0 uses average stroke width.
     * @param {number} [options.minWidth=0.5] Minimum stroke width.
     * @param {number} [options.maxWidth=2.5] Maximum stroke width.
     * @param {string} [options.penColor='black'] Stroke color.
     * @param {number} [options.minDistance=5] Minimum distance between captured points.
     * @param {number} [options.velocityFilterWeight=0.7] Smoothing factor for stroke width.
     * @param {string} [options.backgroundColor='rgba(0,0,0,0)'] Canvas background fill.
     * @param {number} [options.throttle=16] Move-event throttle in milliseconds. Use 0 to disable.
     * @param {string} [options.compositeOperation='source-over'] Canvas composite operation.
     * @param {CanvasRenderingContext2DSettings} [options.canvasContextOptions={}] 2D context options.
     */
    constructor(canvas, options = {}) {
      super();

      const isCanvasElement = canvas && canvas.nodeName && canvas.nodeName.toLowerCase() === 'canvas';

      if (!isCanvasElement) {
        throw new Error('TinySignature requires a valid HTMLCanvasElement.');
      }

      this.canvas = canvas;
      this.velocityFilterWeight = options.velocityFilterWeight || 0.7;
      this.minWidth = options.minWidth || 0.5;
      this.maxWidth = options.maxWidth || 2.5;
      this.throttle = options.throttle ?? 16;
      this.minDistance = options.minDistance ?? 5;
      this.dotSize = options.dotSize || 0;
      this.penColor = options.penColor || 'black';
      this.backgroundColor = options.backgroundColor || 'rgba(0,0,0,0)';
      this.compositeOperation = options.compositeOperation || 'source-over';
      this.canvasContextOptions = options.canvasContextOptions || {};

      this._ctx = canvas.getContext('2d', this.canvasContextOptions);
      if (!this._ctx) {
        throw new Error('TinySignature could not create a 2D canvas context.');
      }

      this._drawingStroke = false;
      this._isEmpty = true;
      this._dataUrl = undefined;
      this._dataUrlOptions = undefined;
      this._lastPoints = [];
      this._data = [];
      this._redoData = [];
      this._lastVelocity = 0;
      this._lastWidth = 0;
      this._strokePointerId = undefined;
      this._strokeMoveUpdate = this.throttle
        ? throttle(TinySignature.prototype._strokeUpdate, this.throttle)
        : TinySignature.prototype._strokeUpdate;
      this._canvasRatio = 1;

      // Bind handlers once. This keeps add/removeEventListener reliable and cheap.
      this._handleMouseDown = this._handleMouseDown.bind(this);
      this._handleMouseMove = this._handleMouseMove.bind(this);
      this._handleMouseUp = this._handleMouseUp.bind(this);
      this._handleTouchStart = this._handleTouchStart.bind(this);
      this._handleTouchMove = this._handleTouchMove.bind(this);
      this._handleTouchEnd = this._handleTouchEnd.bind(this);
      this._handleTouchCancel = this._handleTouchCancel.bind(this);
      this._handlePointerDown = this._handlePointerDown.bind(this);
      this._handlePointerMove = this._handlePointerMove.bind(this);
      this._handlePointerUp = this._handlePointerUp.bind(this);
      this._handlePointerCancel = this._handlePointerCancel.bind(this);

      this.clear();
      this.on();
    }

    /**
     * Clear the canvas and reset stored signature data.
     */
    clear() {
      this._clearCanvas();
      this._data = [];
      this._redoData = [];
      this._dataUrl = undefined;
      this._dataUrlOptions = undefined;
      this._strokePointerId = undefined;
      this._isEmpty = true;
      this.dispatchEvent(createCustomEvent('clear'));
    }

    /**
     * Repaint the current internal signature data.
     * Call this after changing canvas dimensions or background color.
     */
    redraw() {
      const pointGroups = clonePointGroups(this._data);
      const dataUrl = this._dataUrl;
      const dataUrlOptions = this._dataUrlOptions ? { ...this._dataUrlOptions } : undefined;
      const redoData = clonePointGroups(this._redoData);

      this._clearCanvas();
      this._data = [];
      this._redoData = redoData;
      this._dataUrl = dataUrl;
      this._dataUrlOptions = dataUrlOptions;

      if (dataUrl) {
        this.fromDataURL(dataUrl, dataUrlOptions, { storeDataUrl: true });
      }

      this._fromData(pointGroups, this._drawCurve.bind(this), this._drawDot.bind(this));
      this._data = pointGroups;
      this._isEmpty = !dataUrl && pointGroups.length === 0;
    }

    /**
     * Resize the canvas for the current device pixel ratio.
     * Coordinates stay in CSS pixels, while the backing store becomes crisp on HiDPI screens.
     *
     * @param {object} [options={}] Resize options.
     * @param {boolean} [options.preserve=true] Redraw existing signature after resize.
     */
    resizeCanvas({ preserve = true } = {}) {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const displayWidth = Math.max(1, this.canvas.clientWidth || this.canvas.offsetWidth || 1);
      const displayHeight = Math.max(1, this.canvas.clientHeight || this.canvas.offsetHeight || 1);

      this._canvasRatio = ratio;

      this.canvas.width = Math.floor(displayWidth * ratio);
      this.canvas.height = Math.floor(displayHeight * ratio);

      // Reset transform before scaling; assigning width/height usually resets it,
      // but this keeps behavior predictable across browsers.
      if (typeof this._ctx.setTransform === 'function') {
        this._ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
      this._ctx.scale(ratio, ratio);

      if (preserve) {
        this.redraw();
      } else {
        this.clear();
      }
    }

    /**
     * Draw an image data URL on the canvas.
     *
     * @param {string} dataUrl Image data URL.
     * @param {object} [options={}] Placement options.
     * @param {number} [options.ratio=devicePixelRatio] Pixel ratio used for width/height defaults.
     * @param {number} [options.width] Drawn image width in CSS pixels.
     * @param {number} [options.height] Drawn image height in CSS pixels.
     * @param {number} [options.xOffset=0] Horizontal draw offset.
     * @param {number} [options.yOffset=0] Vertical draw offset.
     * @param {object} [internalOptions={}] Internal redraw options.
     * @returns {Promise<void>} Resolves when the image is drawn.
     */
    fromDataURL(dataUrl, options = {}, internalOptions = {}) {
      return new Promise((resolve, reject) => {
        const image = new Image();
        const ratio = options.ratio || window.devicePixelRatio || 1;
        const width = options.width || this.canvas.width / ratio;
        const height = options.height || this.canvas.height / ratio;
        const xOffset = options.xOffset || 0;
        const yOffset = options.yOffset || 0;

        this._reset(this._getPointGroupOptions());

        image.onload = () => {
          this._ctx.drawImage(image, xOffset, yOffset, width, height);
          resolve();
        };
        image.onerror = (error) => reject(error);
        image.crossOrigin = 'anonymous';
        image.src = dataUrl;

        this._isEmpty = false;
        if (internalOptions.storeDataUrl !== false) {
          this._dataUrl = dataUrl;
          this._dataUrlOptions = { ...options };
        }
      });
    }

    /**
     * Export the canvas as a data URL.
     *
     * @param {string} [type='image/png'] MIME type: image/png, image/jpeg, image/svg+xml.
     * @param {number|object} [encoderOptions] JPEG quality or SVG options.
     * @returns {string} Data URL.
     */
    toDataURL(type = 'image/png', encoderOptions) {
      if (type === 'image/svg+xml') {
        const svgOptions = typeof encoderOptions === 'object' ? encoderOptions : undefined;
        return svgToDataURL(this.toSVG(svgOptions));
      }

      const quality = typeof encoderOptions === 'number' ? encoderOptions : undefined;
      return this.canvas.toDataURL(type, quality);
    }

    /**
     * Download the current signature.
     *
     * @param {string} filename Download file name.
     * @param {string} [type='image/png'] Export MIME type.
     * @param {number|object} [encoderOptions] JPEG quality or SVG options.
     * @returns {string} Exported data URL.
     */
    download(filename, type = 'image/png', encoderOptions) {
      const dataURL = this.toDataURL(type, encoderOptions);
      TinySignature.downloadDataURL(dataURL, filename);
      return dataURL;
    }

    /**
     * Enable drawing events.
     */
    on() {
      this.canvas.style.touchAction = 'none';
      this.canvas.style.msTouchAction = 'none';
      this.canvas.style.userSelect = 'none';
      this.canvas.style.webkitUserSelect = 'none';

      const isIOS = /Macintosh/.test(navigator.userAgent) && 'ontouchstart' in document;

      // iOS Scribble can swallow pointer events, so touch events are safer there.
      if (window.PointerEvent && !isIOS) {
        this._handlePointerEvents();
      } else {
        this._handleMouseEvents();

        if ('ontouchstart' in window) {
          this._handleTouchEvents();
        }
      }
    }

    /**
     * Disable drawing events.
     */
    off() {
      this.canvas.style.touchAction = 'auto';
      this.canvas.style.msTouchAction = 'auto';
      this.canvas.style.userSelect = 'auto';
      this.canvas.style.webkitUserSelect = 'auto';

      this.canvas.removeEventListener('pointerdown', this._handlePointerDown);
      this.canvas.removeEventListener('mousedown', this._handleMouseDown);
      this.canvas.removeEventListener('touchstart', this._handleTouchStart);
      this._removeMoveUpEventListeners();
    }

    /**
     * @returns {boolean} True when no visible signature data is stored.
     */
    isEmpty() {
      return this._isEmpty;
    }

    /**
     * Draw point groups previously returned by toData().
     *
     * @param {Array<object>} pointGroups Signature point groups.
     * @param {object} [options={}] Import options.
     * @param {boolean} [options.clear=true] Clear canvas before drawing.
     */
    fromData(pointGroups, { clear = true } = {}) {
      const safePointGroups = clonePointGroups(Array.isArray(pointGroups) ? pointGroups : []);

      if (clear) {
        this._clearCanvas();
        this._data = [];
        this._dataUrl = undefined;
        this._dataUrlOptions = undefined;
      }

      this._fromData(safePointGroups, this._drawCurve.bind(this), this._drawDot.bind(this));
      this._data = this._data.concat(safePointGroups);
      this._redoData = [];
      this._isEmpty = this._data.length === 0;
    }

    /**
     * @returns {Array<object>} Deep clone of stored signature point groups.
     */
    toData() {
      return clonePointGroups(this._data);
    }

    /**
     * Remove the last stroke.
     *
     * @returns {boolean} True when a stroke was removed.
     */
    undo() {
      if (this._data.length === 0) {
        return false;
      }

      const removedPointGroup = this._data.pop();
      this._redoData.push(removedPointGroup);
      this.redraw();
      this.dispatchEvent(createCustomEvent('undo', { detail: removedPointGroup }));
      return true;
    }

    /**
     * Restore the last undone stroke.
     *
     * @returns {boolean} True when a stroke was restored.
     */
    redo() {
      if (this._redoData.length === 0) {
        return false;
      }

      const restoredPointGroup = this._redoData.pop();
      this._data.push(restoredPointGroup);
      this.redraw();
      this.dispatchEvent(createCustomEvent('redo', { detail: restoredPointGroup }));
      return true;
    }

    /**
     * Change pen color for future strokes.
     *
     * @param {string} color CSS color.
     */
    setPenColor(color) {
      this.penColor = color;
    }

    /**
     * Change background color and optionally repaint existing strokes.
     *
     * @param {string} color CSS color.
     * @param {object} [options={}] Update options.
     * @param {boolean} [options.redraw=true] Repaint canvas immediately.
     */
    setBackgroundColor(color, { redraw = true } = {}) {
      this.backgroundColor = color;

      if (redraw) {
        this.redraw();
      }
    }

    /**
     * Change stroke width range for future strokes.
     *
     * @param {number} minWidth Minimum stroke width.
     * @param {number} maxWidth Maximum stroke width.
     */
    setStrokeWidth(minWidth, maxWidth) {
      const safeMinWidth = Math.max(0.1, Number(minWidth) || this.minWidth);
      const safeMaxWidth = Math.max(safeMinWidth, Number(maxWidth) || this.maxWidth);

      this.minWidth = safeMinWidth;
      this.maxWidth = safeMaxWidth;
    }

    /**
     * Change the canvas composite operation for future strokes.
     *
     * @param {GlobalCompositeOperation|string} compositeOperation Canvas composite mode.
     */
    setCompositeOperation(compositeOperation) {
      this.compositeOperation = compositeOperation || 'source-over';
    }

    /**
     * Export the signature as inline SVG markup.
     *
     * @param {object} [options={}] SVG export options.
     * @param {boolean} [options.includeBackgroundColor=false] Add a background rect.
     * @param {boolean} [options.includeDataUrl=false] Include imported image data URL if any.
     * @returns {string} SVG string.
     */
/*
    toSVG({ includeBackgroundColor = false, includeDataUrl = false } = {}) {
      const pointGroups = clonePointGroups(this._data);
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const minX = 0;
      const minY = 0;
      const maxX = this.canvas.width / ratio;
      const maxY = this.canvas.height / ratio;
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
      svg.setAttribute('viewBox', `${minX} ${minY} ${maxX} ${maxY}`);
      svg.setAttribute('width', String(maxX));
      svg.setAttribute('height', String(maxY));

      if (includeBackgroundColor && this.backgroundColor) {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('width', '100%');
        rect.setAttribute('height', '100%');
        rect.setAttribute('fill', this.backgroundColor);
        svg.appendChild(rect);
      }

      if (includeDataUrl && this._dataUrl) {
        const dataUrlRatio = this._dataUrlOptions?.ratio || window.devicePixelRatio || 1;
        const width = this._dataUrlOptions?.width || this.canvas.width / dataUrlRatio;
        const height = this._dataUrlOptions?.height || this.canvas.height / dataUrlRatio;
        const xOffset = this._dataUrlOptions?.xOffset || 0;
        const yOffset = this._dataUrlOptions?.yOffset || 0;
        const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');

        image.setAttribute('x', String(xOffset));
        image.setAttribute('y', String(yOffset));
        image.setAttribute('width', String(width));
        image.setAttribute('height', String(height));
        image.setAttribute('preserveAspectRatio', 'none');
        image.setAttribute('href', this._dataUrl);
        svg.appendChild(image);
      }

      this._fromData(
        pointGroups,
        (curve, { penColor }) => {
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

          // Ignore invalid curves. They can happen after interrupted strokes on some browsers.
          if (
            !Number.isNaN(curve.control1.x) &&
            !Number.isNaN(curve.control1.y) &&
            !Number.isNaN(curve.control2.x) &&
            !Number.isNaN(curve.control2.y)
          ) {
            const pathData =
              `M ${curve.startPoint.x.toFixed(3)},${curve.startPoint.y.toFixed(3)} ` +
              `C ${curve.control1.x.toFixed(3)},${curve.control1.y.toFixed(3)} ` +
              `${curve.control2.x.toFixed(3)},${curve.control2.y.toFixed(3)} ` +
              `${curve.endPoint.x.toFixed(3)},${curve.endPoint.y.toFixed(3)}`;

            path.setAttribute('d', pathData);
            path.setAttribute('stroke-width', (curve.endWidth * 2.25).toFixed(3));
            path.setAttribute('stroke', penColor);
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke-linecap', 'round');
            svg.appendChild(path);
          }
        },
        (point, { penColor, dotSize, minWidth, maxWidth }) => {
          const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          const size = dotSize > 0 ? dotSize : (minWidth + maxWidth) / 2;

          circle.setAttribute('r', String(size));
          circle.setAttribute('cx', String(point.x));
          circle.setAttribute('cy', String(point.y));
          circle.setAttribute('fill', penColor);
          svg.appendChild(circle);
        },
      );

      return svg.outerHTML;
    }
*/

    /**
     * Export the signature as inline SVG markup.
     *
     * @param {object} [options={}] SVG export options.
     * @param {boolean} [options.includeBackgroundColor=false] Add a background rect.
     * @param {boolean} [options.includeDataUrl=false] Include imported image data URL if any.
     * @param {number} [options.precision=3] Number precision for SVG coordinates.
     * @returns {string} SVG string.
     */
    toSVG({
            includeBackgroundColor = false,
            includeDataUrl = false,
            precision = 2
          } = {}) {
      const svgNamespace = 'http://www.w3.org/2000/svg';
      const xlinkNamespace = 'http://www.w3.org/1999/xlink';
      const pointGroups = clonePointGroups(this._data);

      const ratio = this._canvasRatio || 1;
      const width = this.canvas.width / ratio;
      const height = this.canvas.height / ratio;

      const svg = document.createElementNS(svgNamespace, 'svg');

      svg.setAttribute('xmlns', svgNamespace);
      svg.setAttribute('viewBox', `0 0 ${formatSvgNumber(width, precision)} ${formatSvgNumber(height, precision)}`);
      svg.setAttribute('width', formatSvgNumber(width, precision));
      svg.setAttribute('height', formatSvgNumber(height, precision));

      if (includeBackgroundColor && this.backgroundColor) {
        const rect = document.createElementNS(svgNamespace, 'rect');

        rect.setAttribute('width', '100%');
        rect.setAttribute('height', '100%');
        rect.setAttribute('fill', this.backgroundColor);

        svg.appendChild(rect);
      }

      if (includeDataUrl && this._dataUrl) {
        const dataUrlRatio = this._dataUrlOptions?.ratio || 1;
        const imageWidth = this._dataUrlOptions?.width || this.canvas.width / dataUrlRatio;
        const imageHeight = this._dataUrlOptions?.height || this.canvas.height / dataUrlRatio;
        const xOffset = this._dataUrlOptions?.xOffset || 0;
        const yOffset = this._dataUrlOptions?.yOffset || 0;
        const image = document.createElementNS(svgNamespace, 'image');

        svg.setAttribute('xmlns:xlink', xlinkNamespace);

        image.setAttribute('x', formatSvgNumber(xOffset, precision));
        image.setAttribute('y', formatSvgNumber(yOffset, precision));
        image.setAttribute('width', formatSvgNumber(imageWidth, precision));
        image.setAttribute('height', formatSvgNumber(imageHeight, precision));
        image.setAttribute('preserveAspectRatio', 'none');
        image.setAttribute('href', this._dataUrl);
        image.setAttributeNS(xlinkNamespace, 'xlink:href', this._dataUrl);

        svg.appendChild(image);
      }

      let currentPathGroup = null;
      let currentPathGroupColor = null;

      const getPathGroup = (penColor) => {
        if (currentPathGroup && currentPathGroupColor === penColor) {
          return currentPathGroup;
        }

        currentPathGroup = document.createElementNS(svgNamespace, 'g');
        currentPathGroupColor = penColor;

        currentPathGroup.setAttribute('fill', 'none');
        currentPathGroup.setAttribute('stroke', penColor);
        currentPathGroup.setAttribute('stroke-linecap', 'round');

        svg.appendChild(currentPathGroup);

        return currentPathGroup;
      };

      const resetPathGroup = () => {
        // Important when a circle/dot is inserted.
        // The next path group must be appended after the circle to preserve drawing order.
        currentPathGroup = null;
        currentPathGroupColor = null;
      };

      this._fromData(
          pointGroups,

          (curve, { penColor }) => {
            if (!isValidCurve(curve)) {
              return;
            }

            const path = document.createElementNS(svgNamespace, 'path');

            const pathData =
                `M${formatSvgNumber(curve.startPoint.x, precision)},${formatSvgNumber(curve.startPoint.y, precision)}` +
                `C${formatSvgNumber(curve.control1.x, precision)},${formatSvgNumber(curve.control1.y, precision)} ` +
                `${formatSvgNumber(curve.control2.x, precision)},${formatSvgNumber(curve.control2.y, precision)} ` +
                `${formatSvgNumber(curve.endPoint.x, precision)},${formatSvgNumber(curve.endPoint.y, precision)}`;

            path.setAttribute('d', pathData);
            path.setAttribute('stroke-width', formatSvgNumber(curve.endWidth * 2.25, precision));

            getPathGroup(penColor).appendChild(path);
          },

          (point, { penColor, dotSize, minWidth, maxWidth }) => {
            const circle = document.createElementNS(svgNamespace, 'circle');
            const size = dotSize > 0 ? dotSize : (minWidth + maxWidth) / 2;

            circle.setAttribute('r', formatSvgNumber(size, precision));
            circle.setAttribute('cx', formatSvgNumber(point.x, precision));
            circle.setAttribute('cy', formatSvgNumber(point.y, precision));
            circle.setAttribute('fill', penColor);

            svg.appendChild(circle);

            resetPathGroup();
          }
      );

      return new XMLSerializer().serializeToString(svg);

      function isValidCurve(curve) {
        return (
            Number.isFinite(curve.startPoint.x) &&
            Number.isFinite(curve.startPoint.y) &&
            Number.isFinite(curve.control1.x) &&
            Number.isFinite(curve.control1.y) &&
            Number.isFinite(curve.control2.x) &&
            Number.isFinite(curve.control2.y) &&
            Number.isFinite(curve.endPoint.x) &&
            Number.isFinite(curve.endPoint.y)
        );
      }

      function formatSvgNumber(value, maxPrecision) {
        if (!Number.isFinite(value)) {
          return '0';
        }

        return Number(value.toFixed(maxPrecision)).toString();
      }
    }

    /**
     * Remove all event listeners attached by the component.
     * Useful before removing the canvas from the DOM.
     */
    destroy() {
      this.off();
    }

    _clearCanvas() {
      const { canvas } = this;

      this._ctx.fillStyle = this.backgroundColor;
      this._ctx.clearRect(0, 0, canvas.width, canvas.height);
      this._ctx.fillRect(0, 0, canvas.width, canvas.height);
      this._reset(this._getPointGroupOptions());
    }

    _getListenerFunctions() {
      const canvasWindow =
        window.document === this.canvas.ownerDocument
          ? window
          : this.canvas.ownerDocument.defaultView || this.canvas.ownerDocument;

      return {
        addEventListener: canvasWindow.addEventListener.bind(canvasWindow),
        removeEventListener: canvasWindow.removeEventListener.bind(canvasWindow),
      };
    }

    _removeMoveUpEventListeners() {
      const { removeEventListener } = this._getListenerFunctions();

      removeEventListener('pointermove', this._handlePointerMove);
      removeEventListener('pointerup', this._handlePointerUp);
      removeEventListener('pointercancel', this._handlePointerCancel);
      removeEventListener('mousemove', this._handleMouseMove);
      removeEventListener('mouseup', this._handleMouseUp);
      removeEventListener('touchmove', this._handleTouchMove);
      removeEventListener('touchend', this._handleTouchEnd);
      removeEventListener('touchcancel', this._handleTouchCancel);
    }

    _isLeftButtonPressed(event, only = false) {
      return only ? event.buttons === 1 : (event.buttons & 1) === 1;
    }

    _pointerEventToSignatureEvent(event) {
      return {
        event,
        type: event.type,
        x: event.clientX,
        y: event.clientY,
        pressure: 'pressure' in event ? event.pressure : 0,
      };
    }

    _touchEventToSignatureEvent(event) {
      const touch = event.changedTouches[0];

      return {
        event,
        type: event.type,
        x: touch.clientX,
        y: touch.clientY,
        pressure: touch.force || 0,
      };
    }

    _handleMouseDown(event) {
      if (!this._isLeftButtonPressed(event, true) || this._drawingStroke) {
        return;
      }

      this._strokeBegin(this._pointerEventToSignatureEvent(event));
    }

    _handleMouseMove(event) {
      if (!this._isLeftButtonPressed(event, true) || !this._drawingStroke) {
        this._strokeEnd(this._pointerEventToSignatureEvent(event), false);
        return;
      }

      this._strokeMoveUpdate(this._pointerEventToSignatureEvent(event));
    }

    _handleMouseUp(event) {
      if (this._isLeftButtonPressed(event)) {
        return;
      }

      this._strokeEnd(this._pointerEventToSignatureEvent(event));
    }

    _handleTouchStart(event) {
      if (event.targetTouches.length !== 1 || this._drawingStroke) {
        return;
      }

      if (event.cancelable) {
        event.preventDefault();
      }

      this._strokeBegin(this._touchEventToSignatureEvent(event));
    }

    _handleTouchMove(event) {
      if (event.targetTouches.length !== 1) {
        return;
      }

      if (event.cancelable) {
        event.preventDefault();
      }

      if (!this._drawingStroke) {
        this._strokeEnd(this._touchEventToSignatureEvent(event), false);
        return;
      }

      this._strokeMoveUpdate(this._touchEventToSignatureEvent(event));
    }

    _handleTouchEnd(event) {
      if (event.targetTouches.length !== 0) {
        return;
      }

      if (event.cancelable) {
        event.preventDefault();
      }

      this._strokeEnd(this._touchEventToSignatureEvent(event));
    }

    _handleTouchCancel(event) {
      if (event.cancelable) {
        event.preventDefault();
      }

      this._strokeEnd(this._touchEventToSignatureEvent(event), false);
    }

    _getPointerId(event) {
      // persistentDeviceId is experimental, but useful where available.
      return event.persistentDeviceId || event.pointerId;
    }

    _allowPointerId(event, allowUndefined = false) {
      if (typeof this._strokePointerId === 'undefined') {
        return allowUndefined;
      }

      return this._getPointerId(event) === this._strokePointerId;
    }

    _handlePointerDown(event) {
      if (
        this._drawingStroke ||
        !this._isLeftButtonPressed(event) ||
        !this._allowPointerId(event, true)
      ) {
        return;
      }

      this._strokePointerId = this._getPointerId(event);
      event.preventDefault();
      this._strokeBegin(this._pointerEventToSignatureEvent(event));
    }

    _handlePointerMove(event) {
      if (!this._allowPointerId(event)) {
        return;
      }

      if (!this._isLeftButtonPressed(event, true) || !this._drawingStroke) {
        this._strokeEnd(this._pointerEventToSignatureEvent(event), false);
        return;
      }

      event.preventDefault();
      this._strokeMoveUpdate(this._pointerEventToSignatureEvent(event));
    }

    _handlePointerUp(event) {
      if (this._isLeftButtonPressed(event) || !this._allowPointerId(event)) {
        return;
      }

      event.preventDefault();
      this._strokeEnd(this._pointerEventToSignatureEvent(event));
    }

    _handlePointerCancel(event) {
      if (!this._allowPointerId(event)) {
        return;
      }

      event.preventDefault();
      this._strokeEnd(this._pointerEventToSignatureEvent(event), false);
    }

    _getPointGroupOptions(group) {
      return {
        penColor: group && 'penColor' in group ? group.penColor : this.penColor,
        dotSize: group && 'dotSize' in group ? group.dotSize : this.dotSize,
        minWidth: group && 'minWidth' in group ? group.minWidth : this.minWidth,
        maxWidth: group && 'maxWidth' in group ? group.maxWidth : this.maxWidth,
        velocityFilterWeight:
          group && 'velocityFilterWeight' in group ? group.velocityFilterWeight : this.velocityFilterWeight,
        compositeOperation:
          group && 'compositeOperation' in group ? group.compositeOperation : this.compositeOperation,
      };
    }

    _strokeBegin(event) {
      const cancelled = !this.dispatchEvent(
        createCustomEvent('beginStroke', { detail: event, cancelable: true }),
      );

      if (cancelled) {
        return;
      }

      const { addEventListener } = this._getListenerFunctions();

      switch (event.event.type) {
        case 'mousedown':
          addEventListener('mousemove', this._handleMouseMove, { passive: false });
          addEventListener('mouseup', this._handleMouseUp, { passive: false });
          break;
        case 'touchstart':
          addEventListener('touchmove', this._handleTouchMove, { passive: false });
          addEventListener('touchend', this._handleTouchEnd, { passive: false });
          addEventListener('touchcancel', this._handleTouchCancel, { passive: false });
          break;
        case 'pointerdown':
          addEventListener('pointermove', this._handlePointerMove, { passive: false });
          addEventListener('pointerup', this._handlePointerUp, { passive: false });
          addEventListener('pointercancel', this._handlePointerCancel, { passive: false });
          break;
        default:
          break;
      }

      this._drawingStroke = true;
      this._redoData = [];

      const pointGroupOptions = this._getPointGroupOptions();
      const newPointGroup = {
        ...pointGroupOptions,
        points: [],
      };

      this._data.push(newPointGroup);
      this._reset(pointGroupOptions);
      this._strokeUpdate(event);
    }

    _strokeUpdate(event) {
      if (!this._drawingStroke) {
        return;
      }

      if (this._data.length === 0) {
        this._strokeBegin(event);
        return;
      }

      this.dispatchEvent(createCustomEvent('beforeUpdateStroke', { detail: event }));

      const point = this._createPoint(event.x, event.y, event.pressure);
      const lastPointGroup = this._data[this._data.length - 1];
      const lastPoints = lastPointGroup.points;
      const lastPoint = lastPoints.length > 0 && lastPoints[lastPoints.length - 1];
      const isLastPointTooClose = lastPoint ? point.distanceTo(lastPoint) <= this.minDistance : false;
      const pointGroupOptions = this._getPointGroupOptions(lastPointGroup);

      // Skip noisy points that are too close. This improves performance and line quality.
      if (!lastPoint || !isLastPointTooClose) {
        const curve = this._addPoint(point, pointGroupOptions);

        if (!lastPoint) {
          this._drawDot(point, pointGroupOptions);
        } else if (curve) {
          this._drawCurve(curve, pointGroupOptions);
        }

        lastPoints.push({
          time: point.time,
          x: point.x,
          y: point.y,
          pressure: point.pressure,
        });
      }

      this.dispatchEvent(createCustomEvent('afterUpdateStroke', { detail: event }));
    }

    _strokeEnd(event, shouldUpdate = true) {
      this._removeMoveUpEventListeners();

      if (!this._drawingStroke) {
        return;
      }

      if (shouldUpdate) {
        this._strokeUpdate(event);
      }

      this._drawingStroke = false;
      this._strokePointerId = undefined;
      this.dispatchEvent(createCustomEvent('endStroke', { detail: event }));
    }

    _handlePointerEvents() {
      this._drawingStroke = false;
      this.canvas.addEventListener('pointerdown', this._handlePointerDown, { passive: false });
    }

    _handleMouseEvents() {
      this._drawingStroke = false;
      this.canvas.addEventListener('mousedown', this._handleMouseDown, { passive: false });
    }

    _handleTouchEvents() {
      this.canvas.addEventListener('touchstart', this._handleTouchStart, { passive: false });
    }

    _reset(options) {
      this._lastPoints = [];
      this._lastVelocity = 0;
      this._lastWidth = (options.minWidth + options.maxWidth) / 2;
      this._ctx.fillStyle = options.penColor;
      this._ctx.globalCompositeOperation = options.compositeOperation;
    }

    _createPoint(x, y, pressure) {
      const rect = this.canvas.getBoundingClientRect();
      return new Point(x - rect.left, y - rect.top, pressure, Date.now());
    }

    _addPoint(point, options) {
      this._lastPoints.push(point);

      if (this._lastPoints.length > 2) {
        // Copy the first point so the first curve appears without visible lag.
        if (this._lastPoints.length === 3) {
          this._lastPoints.unshift(this._lastPoints[0]);
        }

        const widths = this._calculateCurveWidths(this._lastPoints[1], this._lastPoints[2], options);
        const curve = Bezier.fromPoints(this._lastPoints, widths);

        // Keep only the latest four points. This avoids unbounded growth while drawing.
        this._lastPoints.shift();
        return curve;
      }

      return null;
    }

    _calculateCurveWidths(startPoint, endPoint, options) {
      const velocity =
        options.velocityFilterWeight * endPoint.velocityFrom(startPoint) +
        (1 - options.velocityFilterWeight) * this._lastVelocity;
      const newWidth = this._strokeWidth(velocity, options);
      const widths = {
        end: newWidth,
        start: this._lastWidth,
      };

      this._lastVelocity = velocity;
      this._lastWidth = newWidth;
      return widths;
    }

    _strokeWidth(velocity, options) {
      return Math.max(options.maxWidth / (velocity + 1), options.minWidth);
    }

    _drawCurveSegment(x, y, width) {
      this._ctx.moveTo(x, y);
      this._ctx.arc(x, y, width, 0, 2 * Math.PI, false);
      this._isEmpty = false;
    }

    _drawCurve(curve, options) {
      const widthDelta = curve.endWidth - curve.startWidth;
      const drawSteps = Math.ceil(curve.length()) * 2;

      this._ctx.beginPath();
      this._ctx.fillStyle = options.penColor;
      this._ctx.globalCompositeOperation = options.compositeOperation;

      for (let index = 0; index < drawSteps; index += 1) {
        const t = index / drawSteps;
        const tt = t * t;
        const ttt = tt * t;
        const u = 1 - t;
        const uu = u * u;
        const uuu = uu * u;
        let x = uuu * curve.startPoint.x;
        let y = uuu * curve.startPoint.y;

        x += 3 * uu * t * curve.control1.x;
        x += 3 * u * tt * curve.control2.x;
        x += ttt * curve.endPoint.x;

        y += 3 * uu * t * curve.control1.y;
        y += 3 * u * tt * curve.control2.y;
        y += ttt * curve.endPoint.y;

        const width = Math.min(curve.startWidth + ttt * widthDelta, options.maxWidth);
        this._drawCurveSegment(x, y, width);
      }

      this._ctx.closePath();
      this._ctx.fill();
    }

    _drawDot(point, options) {
      if (!point) {
        return;
      }

      const width = options.dotSize > 0 ? options.dotSize : (options.minWidth + options.maxWidth) / 2;

      this._ctx.beginPath();
      this._ctx.globalCompositeOperation = options.compositeOperation;
      this._drawCurveSegment(point.x, point.y, width);
      this._ctx.closePath();
      this._ctx.fillStyle = options.penColor;
      this._ctx.fill();
    }

    _fromData(pointGroups, drawCurve, drawDot) {
      for (const group of pointGroups) {
        const points = Array.isArray(group.points) ? group.points : [];
        const pointGroupOptions = this._getPointGroupOptions(group);

        if (points.length > 1) {
          for (let index = 0; index < points.length; index += 1) {
            const basicPoint = points[index];
            const point = new Point(basicPoint.x, basicPoint.y, basicPoint.pressure, basicPoint.time);

            if (index === 0) {
              this._reset(pointGroupOptions);
            }

            const curve = this._addPoint(point, pointGroupOptions);
            if (curve) {
              drawCurve(curve, pointGroupOptions);
            }
          }
        } else if (points.length === 1) {
          this._reset(pointGroupOptions);
          drawDot(points[0], pointGroupOptions);
        }
      }
    }

    /**
     * Static helper to convert data URLs to Blob objects.
     *
     * @param {string} dataURL Source data URL.
     * @returns {Blob} Blob with the data URL content type.
     */
    static dataURLToBlob(dataURL) {
      return dataURLToBlob(dataURL);
    }

    /**
     * Static helper to download a data URL.
     *
     * @param {string} dataURL Source data URL.
     * @param {string} filename Download file name.
     */
    static downloadDataURL(dataURL, filename) {
      const blob = dataURLToBlob(dataURL);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.style.display = 'none';
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();

      // Revoke after the click has been handled by the browser.
      setTimeout(() => URL.revokeObjectURL(url), 0);
    }
  }

  TinySignature.Point = Point;
  TinySignature.Bezier = Bezier;
  TinySignature.version = '1.0.0';

  return TinySignature;
});
