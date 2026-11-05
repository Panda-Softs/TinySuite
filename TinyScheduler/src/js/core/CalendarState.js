class CalendarState {
  constructor(options = {}, resolvedView = { view: 'month' }, planningType = 'timeGrid', planningRange = 'day') {
    this.currentDate = parseDateInput(options.initialDate);
    this.currentView = resolvedView.view || options.initialView || 'month';
    this.planningType = planningType;
    this.planningRange = planningRange;
    this.visibleRange = null;
    this.collapsedResources = new Set();
    this.searchQuery = '';
  }

  /**
   * Return only the calendar view state that can be safely persisted.
   *
   * Runtime-only values like currentDate, visibleRange, loading state,
   * selected events, drag state, etc. should not be persisted here.
   *
   * @returns {{view: string, planningType: string, planningRange: string}}
   */
  getViewState() {
    return {
      view: this.currentView,
      planningType: this.planningType,
      planningRange: this.planningRange
    };
  }
}
