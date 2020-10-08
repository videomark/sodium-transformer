const crypto = require('crypto')
const { Transform } = require('stream')

const log4js = require('log4js')
const { v5: uuidv5 } = require('uuid')

const logger = log4js.getLogger('app')

// const FILE_PATTERN = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+\d{2}:\d{2})\s+(\S*)\s+(\{.*\})$/
const SUBDOMAIN_HASH_LENGTH = 16
const SERVICE_HASH_LENGTH = 8

function hash(str) {
  return crypto.createHash('md5').update(str, 'binary').digest('hex')
}

function hostMask(host) {
  const s = host.split('.')
  if (s.length > 1) {
    const subdomain = hash(s[0])
    const serviceAndTld = hash(s.slice(1).join('.'))
    return `${subdomain.substr(
      0,
      Math.min(SUBDOMAIN_HASH_LENGTH, subdomain.length),
    )}.${serviceAndTld.substr(
      0,
      Math.min(SERVICE_HASH_LENGTH, serviceAndTld.length),
    )}`
  }
  const masked = hash(host)
  return hash(masked).substr(0, Math.min(SUBDOMAIN_HASH_LENGTH, masked.length))
}

function sessionMask(line, regStr, sessionMaskSeed) {
  let val = line;
  const re = new RegExp(`"session":"(${regStr})"`);
  const m = line.match(re);
  if (m) {
    val = line.replace(re, (match, p1) => {
      let uuid = uuidv5(p1, Array.from(sessionMaskSeed));
      const uuidVersionIndex = 14;
      uuid = `${uuid.substring(0, uuidVersionIndex)}4${uuid.substring(uuidVersionIndex + 1)}`;
      const index = match.indexOf(p1);
      const masked = `${match.substring(0, index)}${uuid}${match.substring(index + p1.length)}`;
      return masked;
    });
  }
  return val;
}

class SocientyMaskTransform extends Transform {
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

    this.maskStr = options.mask
    this.terminal = new RegExp(options.terminal)
    this.pattern = new RegExp(options.fluentFormat)
    this.sessionMaskStr = options.sessionMask
    this.sessionMaskSeed = options.sessionMaskSeed
  }

  mask(str) {
    let ret = str

    const {
      REMOTE_ADDR,
      location,
      service,
      locationIp,
      video: [
        {
          property: { domainName, src },
          // eslint-disable-next-line camelcase
          play_list_info,
        },
      ],
    } = JSON.parse(ret.match(this.pattern)[3])

    const m = ret.match(this.terminal)
    if (m && m.length > 1) {
      ret = ret.replace(
        new RegExp(m[1].replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'),
        this.maskStr,
      )
    }

    if (domainName) {
      const masked = hostMask(domainName)
      ret = ret.replace(
        `"domainName":"${domainName}"`,
        `"domainName":"${masked}"`,
      )
    }

    ret = sessionMask(ret, this.sessionMaskStr, this.sessionMaskSeed)
    ret = ret.replace(`"service":"${service}",`, '')
    ret = ret.replace(`"REMOTE_ADDR":"${REMOTE_ADDR}",`, '')
    ret = ret.replace(`"location":"${location}",`, '')

    if (locationIp)
      ret = ret.replace(`"locationIp":"${locationIp}",`, '')
    if (src) {
      ret = ret.replace(`"src":"${src}",`, '')
      ret = ret.replace(`,"src":"${src}"}`, '}') // src要素はpropertyの最終要素の可能性がある
    }

    if (play_list_info) {
      play_list_info
        .reduce((acc, cur) => {
          if (!acc.includes(cur.serverIp)) acc.push(cur.serverIp)
          return acc
        }, [])
        .forEach((e) => {
          if (domainName)
            ret = ret.replace(new RegExp(e, 'g'), hostMask(domainName))
        })
    }

    return ret
  }
}

module.exports = SocientyMaskTransform
