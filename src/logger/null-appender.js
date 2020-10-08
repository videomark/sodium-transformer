module.exports = class NullAppender {
    static configure(config, layouts) {
        let layout = layouts.colouredLayout;
        if (config.layout) {
            layout = layouts.layout(config.layout.type, config.layout);
        }
        // eslint-disable-next-line no-unused-vars
        return ((l, timezoneOffset) => {
            // eslint-disable-next-line no-unused-vars
            return (loggingEvent) => {
                // process.stdout.write(`${l(loggingEvent, timezoneOffset)} \n`);
            }
        })(layout, config.timezoneOffset)
    }

    static configuration() {
        return {
            appenders: { custom: { type: NullAppender } },
            categories: {
                default: { appenders: ["custom"], level: "debug" }
            }
        }
    }
}
