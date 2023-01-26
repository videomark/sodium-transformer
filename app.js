#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { PassThrough } = require("stream");

const process = require("process");

const program = require("commander");
const config = require("config");
const log4js = require("log4js");
const mongodb = require("mongodb");
const { v5: uuidv5 } = require('uuid')

// const HttpReadable = require("./src/readable/http");
const FileReadable = require("./src/readable/file");
// const DriveReadable = require("./src/readable/drive");

const FilterTransform = require("./src/transform/filter");
const SaltTransform = require("./src/transform/salt");
const CacheTransform = require("./src/transform/cache");

const CooperateMaskTransform = require("./src/transform/cooperate");
const SocientyMaskTransform = require("./src/transform/socienty");

const MongoWritable = require("./src/writable/mongo");

const NullAppender = require("./src/logger/null-appender");

const Utils = require("./src/utils");

const { version } = require("./package.json");

// const DEFAULT_INPUT_HTTP_HOST = config.get("input.http.host");
// const DEFAULT_INPUT_HTTP_PORT = config.get("input.http.port");
// const DEFAULT_INPUT_FILE_FORMAT_REGEXP = config.get("input.file.format");

const DEFAULT_YOUTUBE_MIN_VIEW_COUNT = config.get("mask.youtube.min");
const DEFAULT_TERMINAL_MASK = config.get("mask.terminal");
const DEFAULT_UA_MASK = config.get("mask.ua");

// const DEFAULT_OUTPUT_FILE_NAME = config.get("output.file.name");
const DEFAULT_OUTPUT_MONGO_DB = config.get("output.mongo.db");
const DEFAULT_OUTPUT_MONGO_URL = config.get("output.mongo.url");
const DEFAULT_OUTPUT_MONGO_SALT_COLLECTION = config.get("output.mongo.saltCollection");
const DEFAULT_OUTPUT_MONGO_BATCH_COLLECTION = config.get("output.mongo.batchCollection");
const DEFAULT_OUTPUT_MONGO_UPDATE_INTERVAL = Number(config.get("output.mongo.updateIntervalMilliseconds"));

const DEFAULT_OUTPUT_DIRECTORY = ".";

const DEFAULT_IGNORE_BIRTHDAY = config.get("input.dir.birthday");

const DEFAULT_MASK = 'XXX';
// const FILE_PATTERN = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+\d{2}:\d{2})\s+(\S*)\s+(\{.*\})$/
const FILE_PATTERN = config.get("input.file.format");
const DEFAULT_SESSION_MASK_PATTERN = config.get("mask.session");

const DEFAULT_VERBOSE_LEVEL = config.get("verbose");

let logger;
let fileName;
let dirName;

let mongoSaltCollection;
let mongoBatchCollection;
let processing

program
    .option("-v, --verbose", "verbosity that can be increased", (_dummyValue, previous) => {
        return previous + 1;
    }, DEFAULT_VERBOSE_LEVEL)
    .option("    --opendata", "公開用データの作成")
    .option("    --debugFile", "salt DB に登録する内容をファイル出力")
    .option("    --outdir [DIRECTORY]", `ファイルの出力先`, DEFAULT_OUTPUT_DIRECTORY)
    .option("    --withoutMongo", "Mongo DB へ登録を行わない dir モードと併用することはできない")
    .option("    --ua [PATTERN]", `ユーザーエージェントの正規表現`, DEFAULT_UA_MASK)
    .option("    --minViewcount [MIN_VALUE]", `フィルタを行う最小視聴回数`, DEFAULT_YOUTUBE_MIN_VIEW_COUNT)
    .option("    --fluentFormat [STRING]", `fluent ログのフォーマットの正規表現`, FILE_PATTERN)
    .option("-g, --gzip", `入力ファイルがgzipで圧縮されている場合指定`)
    .option("    --withoutGzip", `公開用出力ファイルを圧縮しない`)
    // 通常時でも sleep するように変更した .option("    --sleep", `Mongo DB へ登録を行う際にスリープする`)
    .option("    --mongoURL [URL]", `Mongo DBのURL`, DEFAULT_OUTPUT_MONGO_URL)
    .option("    --mongoDB [DB_NAME]", `DBの名前`, DEFAULT_OUTPUT_MONGO_DB)
    .option("    --mongoSaltCollection [COLLECTION_NAME]", `salt コレクションの名前`, DEFAULT_OUTPUT_MONGO_SALT_COLLECTION)
    .option("    --mongoBatchCollection [COLLECTION_NAME]", `batch コレクションの名前`, DEFAULT_OUTPUT_MONGO_BATCH_COLLECTION)
    .option("    --terminal [PATTERN]", `アンドロイド端末名の正規表現`, DEFAULT_TERMINAL_MASK)
    .option("    --mask [STRING]", `端末名を置き換える文字列`, DEFAULT_MASK)
    .option("    --ignoreDays [DAYS]", `dir のときに設定した日より古いファイルは無視する`, DEFAULT_IGNORE_BIRTHDAY)
    .option("    --sessionMask [REGEXP]", `ボットセッションの正規表現`, DEFAULT_SESSION_MASK_PATTERN)
    .option("    --sessionMaskSeed <STRING>", `UUIDの生成種 16byteのhex文字列`)
    .version(version);

program
    .command("file <file>")
    .description("file interface")
    .action(file => {
        fileName = file
    });

program
    .command("dir <dir>")
    .description("directory interface")
    .action(dir => {
        dirName = dir
    });

/* HTTP モードは廃止
program
    .command("http [host] [port]")
    .description("http interface post json data")
    .action((host, port) => {
        readable = new HttpReadable(host || DEFAULT_INPUT_HTTP_HOST, port || DEFAULT_INPUT_HTTP_PORT);
    });
*/

// parse options
program.parse(process.argv);
// NOTE: commander v7 以降コマンドのプロパティとして保存されないのでその対処
Object.assign(program, program.opts()); // TODO: Object.assign() を使用せず適切に分離してより安全に使用してほしい

if (!program.verbose) {

    log4js.configure(NullAppender.configuration());
    logger = log4js.getLogger("app");
} else {

    logger = log4js.getLogger("app");
    if (program.verbose === 1)
        logger.level = "info";
    else
        logger.level = "debug";
}

if (program.sessionMaskSeed === undefined) {
    program.optionMissingArgument({ flags: "     --sessionMaskSeed <STRING>" });
}
try {
    uuidv5("test", Array.from(program.sessionMaskSeed));
} catch (e) {
    program.optionMissingArgument({ flags: "     --sessionMaskSeed <STRING> 16バイトのhex文字列" });
}

/*
// pipe line
//
// readable -> filter -> filteredThrough -> cooperate -> logThrough -> file(xxxx_co.log)
//                              |                            |
//                              |                            +-> socienty -> file(xxx_soc.log)
//                              |
//                              +-> salt -> cache -> cachedThrough -> mongo
//                                                         |
//                                                         +--------> newlineTransform -> file(xxx_deb.json)
*/
async function pipeline(read, name) {

    const task = [];

    const filteredThrough = new PassThrough()
    const cachedThrough = new PassThrough({
        readableObjectMode: true,
        writableObjectMode: true
    });

    if (program.opendata) {
        const co = Utils.genPath(program.outdir, name, "co", program.withoutGzip ? "log" : "log.gz")
        const soc = Utils.genPath(program.outdir, name, "soc", program.withoutGzip ? "log" : "log.gz")
        const th = new PassThrough()

        let coStream = th
            .pipe(Utils.stringNewlineTransform())
        let socStream = th
            .pipe(new SocientyMaskTransform(program))
            .pipe(Utils.stringNewlineTransform())

        if (!program.withoutGzip) {
            coStream = coStream.pipe(zlib.createGzip())
            socStream = socStream.pipe(zlib.createGzip())
        }

        task.push(new Promise((resolve, reject) => {
            coStream
                .pipe(fs.createWriteStream(co))
                .on("finish", () => {
                    logger.debug(`${co} completed`)
                    resolve()
                })
                .on("error", reject)
        }));

        task.push(new Promise((resolve, reject) => {
            socStream
                .pipe(fs.createWriteStream(soc))
                .on("finish", () => {
                    logger.debug(`${soc} completed`)
                    resolve()
                })
                .on("error", reject)
        }));

        filteredThrough
            .pipe(new CooperateMaskTransform(program))
            .pipe(th);
    }

    if (!program.withoutMongo) {
        if (program.debugFile) {
            const deb = Utils.genPath(program.outdir, name, "deb", "json")
            const file = fs.createWriteStream(deb);
            task.push(new Promise((resolve, reject) => {
                cachedThrough
                    .pipe(Utils.newlineTransform())
                    .pipe(file)
                    .on("finish", () => {
                        logger.debug(`${deb} completed`)
                        resolve()
                    })
                    .on("error", reject)
            }));
        }

        const mongo = new MongoWritable({
            updateIntervalMilliseconds: DEFAULT_OUTPUT_MONGO_UPDATE_INTERVAL,
        });
        mongo.init(mongoSaltCollection);
        task.push(new Promise((resolve, reject) => {
            cachedThrough
                .pipe(mongo)
                .on("finish", () => {
                    logger.debug(`mongo completed`)
                    resolve()
                })
                .on("error", reject)
        }));

        filteredThrough
            .pipe(new SaltTransform(program))
            .pipe(new CacheTransform())
            .pipe(cachedThrough)

    }

    await read.init();

    task.push(new Promise((resolve, reject) => {
        read
            .pipe(new FilterTransform(program))
            .pipe(filteredThrough)
            .on("finish", resolve)
            .on("error", reject)
    }));

    return Promise.all(task);
}

async function watch(dir) {
    if (processing) return;
    try {
        processing = true;
        const dirPath = path.resolve(dir);
        const l = await new Promise((resolve, reject) => {
            fs.readdir(dirPath, (e, files) => {
                if (e) {
                    reject(e)
                    return;
                }
                const list = files
                    .reduce((acc, cur) => {
                        const p = [dirPath, cur].join(path.sep)
                        if (!path.basename(p).startsWith("sodium")) return acc;
                        try {
                            const stat = fs.statSync(p)
                            if (!stat.isFile()) return acc;
                            if (Date.now() - new Date(stat.ctime).getTime() >= program.ignoreDays * 24 * 60 * 60 * 1000) return acc;
                            acc.push(p);
                        } catch (err) {
                            logger.error(err)
                        }
                        return acc;
                    }, [])
                    .sort();
                resolve(list)
            });
        })

        const registered = await mongoBatchCollection.find().toArray();
        const target = l.filter(e => !registered.map(ee => (ee.path)).includes(e));

        // DB 存在確認
        if (target.length <= 0) return;

        const completed = [];

        // target.forEach(e => console.log(e))

        logger.info(`${target.length} such file ${target.length < 10 ? target : target.slice(0, 10)}`)

        for (let i = 0; i < target.length; i += 1) {
            // const p = [dirPath, path.basename(l[i])].join(path.sep)
            const readable = new FileReadable(target[i], {
                gzip: target[i].endsWith(".gz")
            });
            try {
                logger.debug("--- pipeline start ---")
                // eslint-disable-next-line no-await-in-loop
                await pipeline(readable, target[i]);
                logger.debug(`--- pipeline end target: ${target[i]}---`)
                completed.push({
                    path: target[i]
                })
            } catch (e) {
                logger.error(e)
            }

            // eslint-disable-next-line no-await-in-loop
            await new Promise((resolve) => setTimeout(resolve, 3000))
        }

        mongoBatchCollection.insertMany(completed);

    } catch (e) {
        logger.error(e);
    } finally {
        processing = false;
    }
}

(async () => {
    let mongoClient;

    logger.debug("--- start ---");

    if (!program.withoutMongo || dirName) {
        logger.info(`write to ${program.mongoURL}/${program.mongoDB}:${program.mongoSaltCollection}`);

        try {
            mongoClient = await mongodb.MongoClient.connect(program.mongoURL, {
                useNewUrlParser: true,
                useUnifiedTopology: true
            });
        } catch (e) {
            logger.error(e);
            return;
        }
        mongoSaltCollection = mongoClient.db(program.mongoDB).collection(program.mongoSaltCollection);
        mongoBatchCollection = mongoClient.db(program.mongoDB).collection(program.mongoBatchCollection);
    }

    if (dirName) {
        logger.info(`watch mode [target: ${dirName}]`)
        setInterval(() => watch(dirName), 1 * 1000)
    } else if (fileName) {

        try {

            fs.statSync(fileName);
        } catch (err) {
            logger.error(err)
            return;
        }
        const readable = new FileReadable(fileName, {
            gzip: program.gzip
        });

        logger.info(readable.description());

        try {
            logger.debug("--- pipeline start ---")
            await pipeline(readable, fileName);
            logger.debug(`--- pipeline end target: ${fileName}---`)
        } catch (e) {
            logger.error(e)
        }

        if (mongoClient) mongoClient.close();
    } else {
        program.outputHelp();

    }
})()
