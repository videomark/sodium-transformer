const fs = require("fs");
const zlib = require("zlib");
const { Transform } = require("stream");
// const { TextEncoder, TextDecoder } = require("util");

const log4js = require("log4js");
const byline = require("byline");

// const utf8Encoder = new TextEncoder();
// const utf8Decoder = new TextDecoder();

const logger = log4js.getLogger("app");

class FileReadable extends Transform {

    constructor(name, options) {

        super({

            transform: (chunk, _encoding, callback) => {

                try {

                    this.push(chunk);
                } catch (e) {

                    logger.error(e);
                } finally {

                    callback();
                }
            }
        });

        this.name = name;
        this.options = options;
    }

    description() {
        return `file interface [file:${this.name}]`;
    }

    async init() {

        let read = fs.createReadStream(this.name);

        if (this.options.gzip)
            read = read.pipe(zlib.createGunzip());

        read.pipe(byline.createStream())
            .pipe(this);
    }
}

module.exports = FileReadable
