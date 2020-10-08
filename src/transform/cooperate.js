const { Transform } = require('stream')
const { URL } = require('url')

const log4js = require('log4js')

const logger = log4js.getLogger('app')

const YOUTUBE_HOST = `www.youtube.com`
const MOBILE_YOUTUBE_HOST = `m.youtube.com`

class CooperateMaskTransform extends Transform {
  constructor(options) {
    super({
      transform: (chunk, _encoding, callback) => {
        try {
          const ret = this.mask(chunk.toString())
          if (ret) this.push(ret)
        } catch (e) {
          logger.error(e)
        } finally {
          callback()
        }
      },
    })
    this.minViewCount = options.minViewcount
    this.format = new RegExp(options.fluentFormat)
  }

  mask(str) {
    const {
      location,
      video: [
        {
          property: { viewCount },
        },
      ],
    } = JSON.parse(str.match(this.format)[3])

    const url = new URL(location)
    if (
      (url.host === YOUTUBE_HOST || url.host === MOBILE_YOUTUBE_HOST) &&
      viewCount < this.minViewCount
    ) {
      return str.replace(location, url.origin)
    }

    return str
  }
}

module.exports = CooperateMaskTransform
