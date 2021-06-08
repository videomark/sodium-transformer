const { Transform } = require('stream');

const log4js = require("log4js");
const NodeCache = require("node-cache");
const UAParser = require("ua-parser-js");
// eslint-disable-next-line camelcase
const holiday_jp = require("@holiday-jp/holiday_jp");

const logger = log4js.getLogger("app");

class SaltTransform extends Transform {

    constructor(options) {

        super({

            readableObjectMode: true,
            writableObjectMode: true,
            transform: (chunk, _encoding, callback) => {

                try {
                    const ret = chunk.toString().match(new RegExp(options.fluentFormat))
                    const salt = this.transform(JSON.parse(ret[3]));
                    if (salt) this.push(salt);
                } catch (e) {

                    logger.error(e);
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

    transform(json) {

        let salt;
        try {

            const { video: [{ property: { uuid } }] } = json;
            if (this.cache.has(uuid))
                salt = this.update(uuid, json);
            else
                salt = this.create(json);

            return salt;
        } catch (e) {
            logger.error(e);
        }
        return null;
    }

    create(json) {

        try {

            const session = json;
            const [video] = session.video;
            const cacheKey = video.property.uuid;
            const ua = new UAParser(session.userAgent);
            const { name: os, version: osVer } = ua.getOS();
            const { name: browser, version: browserVer } = ua.getBrowser();
            const throughputHistory = SaltTransform.generateThroughputHistory(video.throughput_info)
            const eventHistory = SaltTransform.generateEventHistory(video);
            const representations = SaltTransform.generatePlayList(video.play_list_info);
            const representationHistory = SaltTransform.generateRepresentationHistory(video.playback_quality, {});
            const frameDropHistory = SaltTransform.generateDropHistory(video.playback_quality, []);
            const { val: cmHistory, cm } = SaltTransform.generateCmHistory(video.cmHistory, {});
            // const bufferHistory

            const serverHost = new URL(session.location).host;

            const salt = {
                session: {
                    sodiumSessionId: session.session,
                    sodiumVideoId: video.property.uuid,
                    userAgent: {
                        os: `${os}${osVer}`,
                        browser: `${browser}${browserVer}`,
                        original: session.userAgent
                    },
                    session_type: session.session_type ? session.session_type : "personal",
                    qoe: null
                },
                connection: {
                    type: session.netinfo ? session.netinfo.type : undefined,
                    effectiveType: session.netinfo ? session.netinfo.effectiveType : undefined,
                    downlink: session.netinfo ? session.netinfo.downlink : undefined,
                    downlinkMax: session.netinfo ? session.netinfo.downlinkMax : undefined,
                    rtt: session.netinfo ? session.netinfo.rtt : undefined,
                    apn: session.netinfo ? session.netinfo.apn : undefined,
                    plmn: session.netinfo ? session.netinfo.plmn : undefined,
                    sim: session.netinfo ? session.netinfo.sim : undefined
                },
                network: {
                    serverHost,
                    serverIp: session.locationIp,
                    clientIp: session.REMOTE_ADDR,
                    clientLocation: {
                        country: session.country,
                        subdivision: session.subdivision
                    },
                    isp: session.isp
                },
                video: {
                    videoId: video.property.holderId,
                    duration: video.property.mediaSize,
                    representations,
                    playHistory: {
                        startTime: video.property.playStartTime,
                        holiday: holiday_jp.isHoliday(new Date(video.property.playStartTime)),
                        endTime: video.property.playEndTime,
                        throughputHistory,
                        eventHistory,
                        representationHistory,
                        frameDropHistory
                        // bufferHistory
                    },
                    cmHistory
                }
            }

            this.cache.set(cacheKey, { salt, ctx: { cm } });

            return salt;
        } catch (e) {
            logger.error(e);
            return null;
        }
    }

    update(uuid, json) {

        try {

            const cacheKey = uuid;
            const { salt, ctx: { cm } } = this.cache.get(cacheKey);
            const session = json;
            const [video] = session.video;

            salt.video.playHistory.throughputHistory = Array.prototype
                .concat(salt.video.playHistory.throughputHistory, SaltTransform.generateThroughputHistory(video.throughput_info));

            salt.video.playHistory.eventHistory = Array.prototype
                .concat(salt.video.playHistory.eventHistory, SaltTransform.generateEventHistory(video));

            const currentRep = salt.video.playHistory.representationHistory.length > 0
                ? salt.video.playHistory.representationHistory[salt.video.playHistory.representationHistory.length - 1] : {}
            salt.video.playHistory.representationHistory = Array.prototype
                .concat(salt.video.playHistory.representationHistory, SaltTransform.generateRepresentationHistory(video.playback_quality, currentRep))

            salt.video.playHistory.frameDropHistory = SaltTransform.generateDropHistory(video.playback_quality, salt.video.playHistory.frameDropHistory)

            const { val, ctx: next } = SaltTransform.generateCmHistory(video.cmHistory, cm);
            salt.video.cmHistory = Array.prototype.concat(salt.video.cmHistory, val);

            // salt.video.playHistory.bufferHistory = salt.video.playHistory.bufferHistory; // TODO

            this.cache.set(cacheKey, { salt, ctx: { next } });

            return salt;
        } catch (e) {

            logger.error(e);
            return null;
        }
    }

    static generateEventHistory(video) {

        if (!Array.isArray(video.event_play) || !Array.isArray(video.event_pause) || !Array.isArray(video.event_seeking) ||
            !Array.isArray(video.event_seeked) || !Array.isArray(video.event_ended) || !Array.isArray(video.event_stalled) ||
            !Array.isArray(video.event_progress) || !Array.isArray(video.event_waiting) || !Array.isArray(video.event_canplay)) return [];

        function filterFunc(entry) {
            return entry.time && entry.dateTime && entry.playTime && entry.playPos
        }

        function mapFunc(name, entry) {
            return {
                type: name,
                time: {
                    highRes: entry.time,
                    date: entry.dateTime,
                    play: entry.playTime,
                    pos: entry.playPos
                }
            }
        }

        return Array.prototype
            .concat(
                video.event_play.filter(filterFunc).map(e => mapFunc("play", e)),
                video.event_pause.filter(filterFunc).map(e => mapFunc("pause", e)),
                video.event_seeking.filter(filterFunc).map(e => mapFunc("seeking", e)),
                video.event_seeked.filter(filterFunc).map(e => mapFunc("seeked", e)),
                video.event_ended.filter(filterFunc).map(e => mapFunc("ended", e)),
                video.event_stalled.filter(filterFunc).map(e => mapFunc("stalled", e)),
                video.event_progress.filter(filterFunc).map(e => mapFunc("progress", e)), // TODO: progress 削除する?
                video.event_waiting.filter(filterFunc).map(e => mapFunc("waiting", e)),
                video.event_canplay.filter(filterFunc).map(e => mapFunc("canplay", e))
            )
            .sort(({ time: { date: a } }, { time: { date: b } }) => a - b);
    }

    static generateDropHistory(quality, current) {
        const ret = [];

        if (!Array.isArray(quality) || quality.length === 0) return current;

        // 前回の呼び出しで追加した totalFrames 保持用の最後のデータを削除する
        if (current.length === 1) {

            const [{ droppedFrames: d }] = current
            if (d !== 0) ret.push(...current);
        } else if (current.length > 1) {

            const { droppedFrames: pDrop } = current[current.length - 2];
            const { droppedFrames: cDrop } = current[current.length - 1];
            const a = pDrop === cDrop ? current.slice(0, -1) : current;
            ret.push(...a);
        }

        let drop = 0;
        let total = 0;
        if (ret.length > 0) ({ droppedFrames: drop, totalFrames: total } = ret[ret.length - 1]);

        return quality
            .filter(e => e.creationDate && e.droppedVideoFrames)
            .map(e => ({
                time: e.creationDate,
                droppedFrames: e.droppedVideoFrames,
                totalFrames: e.totalVideoFrames
            }))
            .sort(({ time: a }, { time: b }) => a - b)
            .reduce((acc, cur, idx, array) => {

                if (drop !== cur.droppedFrames) {

                    drop = cur.droppedFrames;
                    acc.push(cur);
                } else if (array.length === idx + 1 && // 最後の要素の totalFrames は残すため drop が同じでも追加する
                    cur.totalFrames !== total) {

                    acc.push(cur);
                }
                return acc;
            }, ret);
    }

    // eslint-disable-next-line camelcase
    static generatePlayList(play_list_info) {

        // eslint-disable-next-line camelcase
        if (!Array.isArray(play_list_info) || play_list_info.length === 0) return [];

        return play_list_info
            .map(e => {
                let videoCodec = "";
                let audioCodec = "";
                let videoTargetBitrate = -1;
                let audioTargetBitrate = -1;

                if (e.videoHeight === -1 && e.videoWidth === -1) {
                    audioCodec = e.codec;
                    audioTargetBitrate = e.bps;
                } else {
                    videoCodec = e.codec;
                    videoTargetBitrate = e.bps;
                }

                return {
                    id: e.representationId,
                    resolution: {
                        height: e.videoHeight,
                        width: e.videoWidth
                    },
                    container: e.container,
                    videoCodec,
                    audioCodec,
                    videoTargetBitrate,
                    audioTargetBitrate
                }
            });
    }

    // eslint-disable-next-line camelcase
    static generateThroughputHistory(throughput_info) {

        // eslint-disable-next-line camelcase
        if (!Array.isArray(throughput_info) || throughput_info.length === 0) return [];

        return throughput_info
            .filter(e => e.start && e.end && e.throughput)
            .map(e => ({
                dlTime: e.start,
                throughput: e.throughput,
                rtt: e.end - e.start,
            }))
            .sort(({ dlTime: a }, { dlTime: b }) => a - b)
            .reduce((acc, cur) => {
                if (!acc.find(e => e.dlTime === cur.dlTime)) acc.push(cur);
                return acc;
            }, []);
    }

    // eslint-disable-next-line camelcase
    static generateRepresentationHistory(playback_quality, last) {

        // eslint-disable-next-line camelcase
        if (!Array.isArray(playback_quality) || playback_quality.length === 0) return [];

        let l = last;
        return playback_quality
            .filter(e => e.representation && e.creationDate)
            .map(e => {
                if (e.representation.video && e.representation.audio)
                    return {
                        video: e.representation.video,
                        audio: e.representation.audio,
                        time: e.creationDate
                    }
                return { // IIJ 対応 TODO IIJ も {video, audio} のフォーマットにする
                    video: e.representation,
                    audio: -1,
                    time: e.creationDate
                }
            })
            .sort(({ time: atime }, { time: btime }) => atime - btime)
            .reduce((acc, cur) => {
                if (cur.video !== l.video || cur.audio !== l.audio) {
                    l = cur;
                    acc.push(cur)
                }
                return acc;
            }, []);
    }

    static generateCmHistory(cmHistory, context) {

        if (!Array.isArray(cmHistory) || cmHistory.length === 0) return { val: [], ctx: context };

        let ctx = context;
        const val = cmHistory
            .filter(e => e.type && e.time)
            .reduce((acc, cur) => {
                if (cur.type === "cm") {
                    ctx = cur;
                } else if (cur.type === "main") {
                    if (ctx && ctx.type === "cm" && ctx.time && cur.time - ctx.time > 0) {
                        acc.push({
                            duration: cur.time - ctx.time,
                            startTime: ctx.time,
                            endTime: cur.time
                        })
                    }
                    ctx = {};
                }
                return acc;
            }, []);

        return { val, ctx }
    }
}

module.exports = SaltTransform;
