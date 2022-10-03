#!/usr/bin/env node

const fs = require("fs");
const EventEmitter = require("events");
const zlib = require("zlib");
const crypto = require("crypto")
const process = require("process");
const { PassThrough, Transform, Writable, Readable } = require("stream");

const program = require("commander");
const config = require("config");
const log4js = require("log4js");
const mongodb = require("mongodb");
const moment = require("moment");
const { v5: uuidv5 } = require('uuid');
const { version } = require("./package.json");

const DEFAULT_LOG_LEVEL = 3;
const LOG_LEVEL = ["fatal","error","warn","info","debug","trace"];
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

class Cooperate extends Transform {
    constructor(options) {
        super({
            objectMode: true,
            transform: (salt, _encoding, callback) => {
                try {
                    if (salt.session.userAgent.original && salt.session.userAgent.original.match(new RegExp(program.ua))) {
                        this.push(`${JSON.stringify(salt)}\r\n`);
                    }
                } catch (e) {
                    logger.error(e)
                } finally {
                    callback()
                }
            }
        })
    }
}

class Socienty extends Transform {
    constructor(options) {
        super({
            objectMode: true,
            transform: (salt, _encoding, callback) => {
                try {
                    if (salt.session.userAgent.original && salt.session.userAgent.original.match(new RegExp(program.ua))) {
                        const sessionRe = new RegExp(program.sessionMask);
                        if (salt.session.sodiumSessionId && salt.session.sodiumSessionId.match(sessionRe)) {
                            salt.session.sodiumSessionId = salt.session.sodiumSessionId.replace(sessionRe, match => {
                                let uuid = uuidv5(match, Array.from(program.sessionMaskSeed));
                                const uuidVersionIndex = 14;
                                return `${uuid.substring(0, uuidVersionIndex)}4${uuid.substring(uuidVersionIndex + 1)}`;
                            });
                        }
                        const terminalRe = new RegExp(program.terminal)
                        if (salt.session.userAgent.original && salt.session.userAgent.original.match(terminalRe)) {
                            salt.session.userAgent.original = salt.session.userAgent.original.replace(terminalRe, (_match, p1, _offset, string) => {
                                return string.replace(p1, program.mask);
                            });
                        }
                        if (salt.network.serverHost)
                            salt.network.serverHost = hostMask(salt.network.serverHost)
                        if (salt.network.serverIp)
                            delete salt.network.serverIp;
                        if (salt.network.clientIp)
                            delete salt.network.clientIp;

                        this.push(`${JSON.stringify(salt)}\r\n`);
                    }
                } catch (e) {
                    logger.error(e)
                } finally {
                    callback()
                }
            }
        })
    }
}

program
    .option("-v, --verbose", "verbosity that can be increased", (_dummyValue, previous) =>
        previous + 1 >= LOG_LEVEL.length ? previous : previous + 1
    , DEFAULT_LOG_LEVEL)
    .option("    --sessionMask [REGEXP]", `ボットセッションの正規表現`, config.get("mask.session"))
    .option("    --sessionMaskSeed <STRING>", `UUIDの生成種 16byteのhex文字列`)
    .option("    --terminal [PATTERN]", `アンドロイド端末名の正規表現`, config.get("mask.terminal"))
    .option("    --mask [STRING]", `端末名を置き換える文字列`, "XXX")
    .option("    --ua [PATTERN]", `ユーザーエージェントの正規表現`, config.get("mask.ua"))
    .version(version);

program.parse(process.argv);
// NOTE: commander v7 以降コマンドのプロパティとして保存されないのでその対処
Object.assign(program, program.opts()); // TODO: Object.assign() を使用せず適切に分離してより安全に使用してほしい

const logger = log4js.getLogger("app");
logger.level = program.verbose ? LOG_LEVEL[program.verbose]: LOG_LEVEL[DEFAULT_LOG_LEVEL];

(async () => {
    const emitter = new EventEmitter();

    logger.debug("--- start ---");
    logger.info(`connect to ${config.get("output.mongo.url")}/${config.get("output.mongo.db")}:${config.get("output.mongo.saltCollection")}`);

    const from = moment(program.args[0]);
    const to = moment(program.args[1]);

    const coFname = `${from.format("MM_DD")}-${to.format("MM_DD")}_co.log.gz`;
    const socFname = `${from.format("MM_DD")}-${to.format("MM_DD")}_soc.log.gz`;

    logger.info(`generate from ${from} to ${to}`);

    if (!from.isValid() || !to.isValid()) {
        logger.error(`unsupport date format`);
        return;
    }

    if (program.sessionMaskSeed === undefined) {
        program.optionMissingArgument({ flags: "     --sessionMaskSeed <STRING>" });
    }

    try {
        uuidv5("test", Array.from(program.sessionMaskSeed));
    } catch (e) {
        program.optionMissingArgument({ flags: "     --sessionMaskSeed <STRING> 16バイトのhex文字列" });
    }

    let client;
    try {
        client = await mongodb.MongoClient.connect(config.get("output.mongo.url"), {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
    } catch (e) {
        logger.error(e);
        return;
    }

    const collection = client.db(config.get("output.mongo.db")).collection(config.get("output.mongo.saltCollection"));

    const coCursor = await collection.find({
        $and: [
            {"video.playHistory.startTime": { $gte: from.utc().toDate().getTime()}},
            {"video.playHistory.startTime": { $lt: to.utc().toDate().getTime()}},
        ]
    });

    const socCursor = await collection.find({
        $and: [
            {"video.playHistory.startTime": { $gte: from.utc().toDate().getTime()}},
            {"video.playHistory.startTime": { $lt: to.utc().toDate().getTime()}},
        ]
    });

    let count = 0;

    coCursor
        .stream()
        .pipe(new Cooperate())
        .pipe(zlib.createGzip())
        .pipe(fs.createWriteStream(coFname))
        .on("finish", () => {
            logger.info("Cooperate finish");
            emitter.emit("finish");
        });

    socCursor
        .stream()
        .pipe(new Socienty())
        .pipe(zlib.createGzip())
        .pipe(fs.createWriteStream(socFname))
        .on("finish", () => {
            logger.info("Socienty finish");
            emitter.emit("finish");
        });

    emitter.on("finish", () => {
        if (++count > 1) {
            logger.info("finish");
            client.close();
        }
    });
})()
