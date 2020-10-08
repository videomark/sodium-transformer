const { Transform } = require('stream')

const log4js = require('log4js')

const logger = log4js.getLogger('app')

const FLUENT_TAG = 'sodium'

class FilterTransform extends Transform {
  constructor(options) {
    super({
      transform: (chunk, _encoding, callback) => {
        try {
          const str = chunk.toString()
          const ret = str.match(new RegExp(options.fluentFormat))
          if (!ret) return
          if (ret.length !== 4) return
          if (ret[2] !== FLUENT_TAG) return
          // TODO USER AGENT によるフィルタは廃止するかどうか
          const { userAgent, location } = JSON.parse(ret[3])
          if (
            userAgent &&
            location &&
            userAgent.match(new RegExp(options.ua))
          ) {
            this.push(str)
          }
        } catch (e) {
          logger.error(e)
        } finally {
          callback()
        }
      },
    })
  }
}

module.exports = FilterTransform
