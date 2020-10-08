const { Transform } = require('stream');

const log4js = require("log4js");
const NodeCache = require("node-cache");

const logger = log4js.getLogger("app");

class CacheTransform extends Transform {

    constructor() {

        super({

            readableObjectMode: true,
            writableObjectMode: true,
            transform: (salt, _encoding, callback) => {

                try {

                    const { session: { sodiumVideoId } } = salt
                    logger.debug(`cache update view[id:${salt.session.sodiumVideoId}]`)
                    this.cache.set(sodiumVideoId, salt);
                } catch (e) {

                    logger.error(e);
                } finally {

                    callback();
                }
            },

            final: (callback) => {

                try {

                    const keys = this.cache.keys();
                    const values = this.cache.mget(keys);
                    Object.values(values).forEach(e => this.push(e))

                } catch (e) {

                    logger.error(e)
                } finally {

                    callback();
                }
            }
        });

        this.cache = new NodeCache({
            stdTTL: 0,
            checkperiod: 0
        });
    }
}
module.exports = CacheTransform;