class CalendarStateStorage {
    static configure(options = {}) {
        this.options = {
            ...CalendarStateStorage.DEFAULT_OPTIONS,
            ...(this.options || {}),
            ...(options || {})
        };

        return this;
    }

    static getOptions() {
        return {
            ...CalendarStateStorage.DEFAULT_OPTIONS,
            ...(this.options || {})
        };
    }

    static isEnabled() {
        const options = this.getOptions();

        return options.enabled !== false
            && typeof window !== 'undefined'
            && Boolean(window.localStorage)
            && Boolean(options.key);
    }

    static getState() {
        if (!this.isEnabled()) return {};

        const options = this.getOptions();

        try {
            return this.normalizeValue(
                window.localStorage.getItem(options.key)
            );
        } catch (error) {
            return {};
        }
    }

    static setState(state = {}) {
        if (!this.isEnabled()) return {};

        const options = this.getOptions();
        const normalizedState = this.normalizeValue(state);

        try {
            window.localStorage.setItem(
                options.key,
                JSON.stringify(normalizedState)
            );
        } catch (error) {
            // Storage must never break the calendar.
        }

        return normalizedState;
    }

    static mergeState(patch = {}) {
        return this.setState({
            ...this.getState(),
            ...this.normalizeValue(patch)
        });
    }

    static getViewState() {
        const state = this.getState();

        return {
            view: state.view,
            planningType: state.planningType,
            planningRange: state.planningRange
        };
    }

    static setViewState(calendarState) {
        const viewState = isFn(calendarState?.getViewState)
            ? calendarState.getViewState()
            : calendarState || {};

        return this.mergeState({
            view: viewState.view,
            planningType: viewState.planningType,
            planningRange: viewState.planningRange
        });
    }

    static getSidebarState() {
        const state = this.getState();

        return {
            sidebarCollapsed: state.sidebarCollapsed
        };
    }

    static setSidebarState(sidebarCollapsed) {
        return this.mergeState({
            sidebarCollapsed: Boolean(sidebarCollapsed)
        });
    }

    static clearState() {
        if (!this.isEnabled()) return this;

        const options = this.getOptions();

        try {
            window.localStorage.removeItem(options.key);
        } catch (error) {
            // Ignore storage errors.
        }

        return this;
    }

    static normalizeValue(value) {
        if (!value) return {};

        if (typeof value === 'string') {
            try {
                return JSON.parse(value) || {};
            } catch (error) {
                return {};
            }
        }

        return typeof value === 'object' ? value : {};
    }
}
CalendarStateStorage.DEFAULT_OPTIONS = Object.freeze({
    enabled: true,
    key: 'TinyScheduler'
});

CalendarStateStorage.options = { ...CalendarStateStorage.DEFAULT_OPTIONS };
