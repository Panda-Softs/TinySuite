;(function ($, TinySelectize) {

    const pluginName = 'tinySelectize';

    function registerPlugin(pluginName, PluginCtor) {

        if (typeof PluginCtor !== 'function') {
            throw new Error(`registerJqueryPlugin: invalid constructor for '${pluginName}'.`);
        }

        $.fn[pluginName] = function (options) {
            const args = Array.prototype.slice.call(arguments, 1);
            const instances = [];
            let returnValue; // for getters/methods on first element

            this.each(function (idx) {
                const el = this;
                let instance = el.selectize;

                // init
                if (!instance) {
                    if (options === undefined || typeof options === 'object') {
                        instance = new PluginCtor(el, options || {});
                        instances.push(instance);
                        return;
                    }
                    throw new Error('tinySelectize: element is not initialized yet.');
                }
                else if (typeof options == 'string') {

                    if (options === 'get') {
                        if (idx === 0) returnValue = instance;
                        return;
                    }

                    var fn = instance[options];
                    if (typeof fn !== 'function') throw new Error(`${pluginName}: unknown method '${options }'.`);

                    var res = fn.apply(instance, args);
                    if (idx === 0 && typeof res !== 'undefined' && res !== instance) {
                        returnValue = res;
                    }
                    return;
                }

                instances.push(instance);
            });

            if (typeof returnValue !== 'undefined') return returnValue;

            if (instances.length) {
                return instances.length === 1 ? instances[0] : instances;
            }

            return this;
        };
    }

    registerPlugin(pluginName, TinySelectize);

}(jQuery, TinySelectize));