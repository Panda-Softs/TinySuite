/**
 * Event layout utilities
 * ----------------------
 * Computes FullCalendar-like horizontal placement for timed events.
 *
 * The important difference from a simple lane/grid algorithm is that events
 * are represented as a dependency web:
 * - events are stacked into collision levels;
 * - each event knows which later-level events overlap it;
 * - widths are stretched from this web so events can use available space;
 * - with slotEventOverlap enabled, visible width is doubled and capped at 100%,
 *   matching FullCalendar's timeGrid behavior.
 */

const DEFAULT_TIMED_EVENT_LAYOUT_OPTIONS = Object.freeze({
  minMinutes: 0,
  maxMinutes: 24 * 60,
  slotEventOverlap: true,
  eventMaxStack: null
});

/**
 * Build horizontal layout data for one day/resource timed event column.
 *
 * @param {Array<Object>} events - Normalized timed events.
 * @param {Object} options - Layout options.
 * @param {number} options.minMinutes - Visible start time in minutes.
 * @param {number} options.maxMinutes - Visible end time in minutes.
 * @param {boolean} options.slotEventOverlap - Whether events visually overlap.
 * @param {number|null} options.eventMaxStack - Optional max stack depth.
 * @returns {Map<string, Object>} Layout by event id.
 */
function buildTimedEventLayout(events, options = {}) {
  const layoutOptions = {
    ...DEFAULT_TIMED_EVENT_LAYOUT_OPTIONS,
    ...options
  };

  const segments = events
      .map(event => createTimedEventSegment(event, layoutOptions))
      .filter(Boolean)
      .sort(sortTimedEventSegments);

  if (!segments.length) {
    return new Map();
  }

  const hierarchy = new TimedEventHierarchy(
      segments,
      layoutOptions.eventMaxStack
  );

  const web = stretchTimedEventWeb(
      buildTimedEventWeb(hierarchy),
      1
  );

  return timedEventWebToLayoutMap(
      web,
      layoutOptions.slotEventOverlap
  );
}

/**
 * Convert a raw event into a visible timed segment.
 *
 * @param {Object} event - Normalized event.
 * @param {Object} options - Layout options.
 * @returns {Object|null}
 */
function createTimedEventSegment(event, options) {
  const eventStart = parseDateInput(event.start);
  const eventEnd = event.end
      ? parseDateInput(event.end)
      : addMinutes(eventStart, 60);

  const rawStartMinute = eventStart.getHours() * 60 + eventStart.getMinutes();
  const rawEndMinute = eventEnd.getHours() * 60 + eventEnd.getMinutes();

  const start = Math.max(options.minMinutes, rawStartMinute);
  const end = Math.min(options.maxMinutes, rawEndMinute);

  if (end <= start) {
    return null;
  }

  return {
    event,
    eventId: String(event.id),
    start,
    end,
    thickness: 1,
    depth: 0
  };
}

/**
 * Stable ordering for timed foreground events.
 *
 * Longer events first for the same start produces a stable, familiar stacking.
 *
 * @param {Object} firstSegment - First segment.
 * @param {Object} secondSegment - Second segment.
 * @returns {number}
 */
function sortTimedEventSegments(firstSegment, secondSegment) {
  return firstSegment.start - secondSegment.start
      || secondSegment.end - firstSegment.end
      || String(firstSegment.eventId).localeCompare(String(secondSegment.eventId));
}

/**
 * Minimal hierarchy used by the web placement algorithm.
 *
 * A level contains non-overlapping segments. A later level contains segments
 * that collide with earlier levels. This mirrors the useful part of
 * FullCalendar's SegHierarchy for timeGrid foreground events.
 */
class TimedEventHierarchy {
  constructor(segments, maxDepth = null) {
    this.maxDepth = maxDepth;
    this.placementsByLevel = [];
    this.levelCoords = [];
    this.hiddenSegments = [];

    segments.forEach(segment => this.insertSegment(segment));
  }

  /**
   * Insert one segment into the first valid non-colliding level.
   *
   * @param {Object} segment - Timed segment.
   * @returns {TimedEventHierarchy}
   */
  insertSegment(segment) {
    const levelIndex = this.findAvailableLevelIndex(segment);

    if (this.maxDepth != null && levelIndex >= this.maxDepth) {
      this.hiddenSegments.push(segment);
      return this;
    }

    if (!this.placementsByLevel[levelIndex]) {
      this.placementsByLevel[levelIndex] = [];
      this.levelCoords[levelIndex] = levelIndex;
    }

    const placement = {
      ...segment,
      depth: levelIndex
    };

    const level = this.placementsByLevel[levelIndex];
    const insertionIndex = findSortedInsertionIndex(level, placement, compareSegmentsByEndThenStart);

    level.splice(insertionIndex, 0, placement);

    return this;
  }

  /**
   * Find the first level where this segment can be placed without collision.
   *
   * @param {Object} segment - Timed segment.
   * @returns {number}
   */
  findAvailableLevelIndex(segment) {
    for (let levelIndex = 0; levelIndex < this.placementsByLevel.length; levelIndex += 1) {
      const level = this.placementsByLevel[levelIndex];
      const hasCollision = level.some(placement => timedSegmentsOverlap(placement, segment));

      if (!hasCollision) {
        return levelIndex;
      }
    }

    return this.placementsByLevel.length;
  }
}

/**
 * Build a pressure web from the hierarchy.
 *
 * Each node points to overlapping nodes in the next available level. The web is
 * later stretched so each top-level chain fills the full 0..1 horizontal range.
 *
 * @param {TimedEventHierarchy} hierarchy - Timed event hierarchy.
 * @returns {Array<Object>}
 */
function buildTimedEventWeb(hierarchy) {
  const { placementsByLevel } = hierarchy;
  const buildNode = cacheByKey(
      (level, lateral) => `${level}:${lateral}`,
      (level, lateral) => {
        const siblingRange = findNextLevelSegments(hierarchy, level, lateral);
        const [nextLevelNodes, maxPressure] = buildTimedEventNodes(siblingRange, buildNode);
        const placement = placementsByLevel[level][lateral];

        return [
          {
            ...placement,
            nextLevelNodes
          },
          placement.thickness + maxPressure
        ];
      }
  );

  const [topLevelNodes] = buildTimedEventNodes(
      placementsByLevel.length
          ? {
            level: 0,
            lateralStart: 0,
            lateralEnd: placementsByLevel[0].length
          }
          : null,
      buildNode
  );

  return topLevelNodes;
}

/**
 * Build web nodes for a sibling range.
 *
 * @param {{level:number,lateralStart:number,lateralEnd:number}|null} siblingRange - Sibling range.
 * @param {Function} buildNode - Node builder.
 * @returns {[Array<Object>, number]}
 */
function buildTimedEventNodes(siblingRange, buildNode) {
  if (!siblingRange) {
    return [[], 0];
  }

  const pairs = [];

  for (let lateral = siblingRange.lateralStart; lateral < siblingRange.lateralEnd; lateral += 1) {
    pairs.push(buildNode(siblingRange.level, lateral));
  }

  pairs.sort((firstPair, secondPair) => secondPair[1] - firstPair[1]);

  return [
    pairs.map(pair => pair[0]),
    pairs[0]?.[1] || 0
  ];
}

/**
 * Find overlapping segments in the next lower level.
 *
 * @param {TimedEventHierarchy} hierarchy - Timed event hierarchy.
 * @param {number} subjectLevel - Current level index.
 * @param {number} subjectLateral - Current lateral index.
 * @returns {{level:number,lateralStart:number,lateralEnd:number}|null}
 */
function findNextLevelSegments(hierarchy, subjectLevel, subjectLateral) {
  const { placementsByLevel } = hierarchy;
  const subjectPlacement = placementsByLevel[subjectLevel][subjectLateral];

  for (let level = subjectLevel + 1; level < placementsByLevel.length; level += 1) {
    const placements = placementsByLevel[level];
    let lateralStart = -1;
    let lateralEnd = -1;

    for (let lateral = 0; lateral < placements.length; lateral += 1) {
      const placement = placements[lateral];

      if (placement.end <= subjectPlacement.start) {
        continue;
      }

      if (placement.start >= subjectPlacement.end) {
        break;
      }

      if (lateralStart === -1) {
        lateralStart = lateral;
      }

      lateralEnd = lateral + 1;
    }

    if (lateralStart !== -1) {
      return {
        level,
        lateralStart,
        lateralEnd
      };
    }
  }

  return null;
}

/**
 * Stretch a web of nodes so coordinates/thickness fill the 0..1 range.
 *
 * @param {Array<Object>} topLevelNodes - Top-level nodes.
 * @param {number} totalThickness - Total available thickness.
 * @returns {Array<Object>}
 */
function stretchTimedEventWeb(topLevelNodes, totalThickness) {
  const stretchNode = cacheByKey(
      node => node.eventId,
      (node, startCoord, previousThickness) => {
        const allThickness = node.thickness + previousThickness;
        const thicknessFraction = node.thickness / allThickness;
        let endCoord;
        const nextLevelNodes = [];

        if (!node.nextLevelNodes.length) {
          endCoord = totalThickness;
        } else {
          node.nextLevelNodes.forEach(childNode => {
            const [childEndCoord, stretchedChildNode] = stretchNode(
                childNode,
                endCoord === undefined ? startCoord : endCoord,
                endCoord === undefined ? allThickness : 0
            );

            if (endCoord === undefined) {
              endCoord = childEndCoord;
            }

            nextLevelNodes.push(stretchedChildNode);
          });
        }

        const thickness = (endCoord - startCoord) * thicknessFraction;

        return [
          endCoord - thickness,
          {
            ...node,
            thickness,
            nextLevelNodes
          }
        ];
      }
  );

  return topLevelNodes.map(node => stretchNode(node, 0, 0)[1]);
}

/**
 * Convert a stretched web into a layout map usable by views.
 *
 * @param {Array<Object>} topLevelNodes - Stretched top-level nodes.
 * @param {boolean} slotEventOverlap - Whether events should visually overlap.
 * @returns {Map<string, Object>}
 */
function timedEventWebToLayoutMap(topLevelNodes, slotEventOverlap) {
  const layoutMap = new Map();
  const processNode = cacheByKey(
      node => node.eventId,
      (node, levelCoord, stackDepth) => {
        let stackForward = 0;

        node.nextLevelNodes.forEach(childNode => {
          stackForward = Math.max(
              processNode(childNode, levelCoord + node.thickness, stackDepth + 1) + 1,
              stackForward
          );
        });

        const nearCoord = clamp01(levelCoord);
        const baseFarCoord = clamp01(levelCoord + node.thickness);
        const farCoord = slotEventOverlap
            ? Math.min(1, nearCoord + (baseFarCoord - nearCoord) * 2)
            : baseFarCoord;

        layoutMap.set(node.eventId, {
          leftPercent: nearCoord * 100,
          rightPercent: (1 - farCoord) * 100,
          widthPercent: (farCoord - nearCoord) * 100,
          baseWidthPercent: (baseFarCoord - nearCoord) * 100,
          levelCoord: nearCoord,
          farCoord,
          thickness: node.thickness,
          stackDepth,
          stackForward,
          zIndex: stackDepth + 1,
          isOverlapping: stackDepth > 0 || stackForward > 0
        });

        return stackForward;
      }
  );

  topLevelNodes.forEach(node => processNode(node, 0, 0));

  return layoutMap;
}


/**
 * Return full-width default layout for events without computed layout.
 *
 * @returns {Object}
 */
function getDefaultTimedEventLayout() {
  return {
    leftPercent: 0,
    rightPercent: 0,
    widthPercent: 100,
    baseWidthPercent: 100,
    levelCoord: 0,
    farCoord: 1,
    thickness: 1,
    stackDepth: 0,
    stackForward: 0,
    zIndex: 1,
    isOverlapping: false
  };
}

/**
 * Compare segments by end, then start.
 *
 * @param {Object} firstSegment - First segment.
 * @param {Object} secondSegment - Second segment.
 * @returns {number}
 */
function compareSegmentsByEndThenStart(firstSegment, secondSegment) {
  return firstSegment.end - secondSegment.end
      || firstSegment.start - secondSegment.start
      || String(firstSegment.eventId).localeCompare(String(secondSegment.eventId));
}

/**
 * Find an insertion index in a sorted array.
 *
 * @param {Array<Object>} array - Sorted array.
 * @param {Object} item - Item to insert.
 * @param {Function} compare - Compare function.
 * @returns {number}
 */
function findSortedInsertionIndex(array, item, compare) {
  let low = 0;
  let high = array.length;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);

    if (compare(array[middle], item) <= 0) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return low;
}

/**
 * Check if two timed segments overlap.
 *
 * End touching start is not an overlap.
 *
 * @param {Object} firstSegment - First segment.
 * @param {Object} secondSegment - Second segment.
 * @returns {boolean}
 */
function timedSegmentsOverlap(firstSegment, secondSegment) {
  return firstSegment.start < secondSegment.end
      && secondSegment.start < firstSegment.end;
}

/**
 * Clamp a number to 0..1.
 *
 * @param {number} value - Raw value.
 * @returns {number}
 */
function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

/**
 * Tiny memoization helper for recursive layout functions.
 *
 * @param {Function} keyFunction - Cache key builder.
 * @param {Function} workFunction - Expensive function.
 * @returns {Function}
 */
function cacheByKey(keyFunction, workFunction) {
  const cache = Object.create(null);

  return (...args) => {
    const key = keyFunction(...args);

    if (Object.prototype.hasOwnProperty.call(cache, key)) {
      return cache[key];
    }

    cache[key] = workFunction(...args);

    return cache[key];
  };
}
