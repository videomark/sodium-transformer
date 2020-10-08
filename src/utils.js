const fs = require('fs');
const path = require("path");
const readline = require('readline');
const { Transform } = require('stream');
const { TextEncoder, TextDecoder } = require('util');

const log4js = require("log4js");

const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder();

const logger = log4js.getLogger("app");

class Utils {
    /**
     * Normalize a port into a number, string, or false.
     */
    static normalizePort(val) {

        const port = parseInt(val, 10);

        if (Number.isNaN(port)) {

            // named pipe
            return val;
        }

        if (port >= 0) {

            // port number
            return port;
        }

        return false;
    }

    static forEachLine(file, func) {

        return new Promise((resolve, reject) => {

            const rs = fs.createReadStream(file);
            rs
                .on('error', (e) => {

                    reject(e);
                });
            const rl = readline.createInterface(rs, {});
            rl
                .on('line', line => {

                    func(line);
                })
                .on('close', () => {

                    resolve();
                })
                .on('error', () => {

                    reject();
                });
        });
    }

    static stringTransform() {

        const obj = new Transform({

            writableObjectMode: true,
            transform: (chunk, _encoding, callback) => {

                try {

                    this.push(utf8Decoder.decode(chunk));
                } catch (e) {

                    logger.error(e);
                } finally {

                    callback();
                }
            }
        });
        return obj;
    }

    static jsonTransform() {

        const obj = new Transform({

            writableObjectMode: true,
            transform: (chunk, _encoding, callback) => {

                try {

                    const str = utf8Decoder.decode(chunk);
                    const json = JSON.parse(str);
                    if (json)
                        this.push(json);
                } catch (e) {

                    logger.error(e);
                } finally {

                    callback();
                }
            }
        });
        return obj;
    }

    static newlineTransform() {

        const obj = new Transform({

            readableObjectMode: true,
            writableObjectMode: true,
            transform: (chunk, _encoding, callback) => {

                try {

                    obj.push(`${JSON.stringify(chunk)}\r\n`);
                } finally {

                    callback();
                }
            }
        });
        return obj;
    }

    static stringNewlineTransform() {

        const obj = new Transform({
            transform: (chunk, _encoding, callback) => {

                try {

                    obj.push(`${chunk}\r\n`);
                } finally {

                    callback();
                }
            }
        });
        return obj;
    }

    static trimTransform() {

        const obj = new Transform({

            transform: (chunk, encoding, callback) => {

                try {

                    const str = utf8Decoder.decode(chunk);
                    const bytes = utf8Encoder.encode(`${str.trim()}`);
                    obj.push(bytes);
                } finally {

                    callback();
                }
            }
        });
        return obj;
    }

    static genPath(dir, file, sufix, ext) {
        const org = path.basename(file).split(".").slice(0, 2).join("_")
        const base = [`${org}_${sufix}`, ext].join(".")
        return [dir, base].join(path.sep);
    }
}

module.exports = Utils