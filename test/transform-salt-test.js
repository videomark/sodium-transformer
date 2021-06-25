const assert = require("assert");
const expect = require("chai").expect;
const { beforeEach, describe, it, afterEach } = require("mocha");

const SaltTransform = require("../src/transform/salt");

// eslint-disable-next-line no-console, no-unused-vars
const print = console.log;

describe("SaltTransform generateEventHistory test", () => {

    beforeEach(async () => {

    });

    it("success", async () => {

        const v = [{
            time: 77737.88500006776,
            dateTime: 1575450590919.0,
            playPos: 0.072406,
            playTime: 0.428
        }, {
            time: 78068.65500006825,
            dateTime: 1575450591250.0,
            playPos: 0.403124,
            playTime: 0.759
        }, {
            time: 79126.47999997716,
            dateTime: 1575450592308.0,
            playPos: 1.461028,
            playTime: 1.817
        }];

        const video = {
            event_play: [v[2], v[1], v[0]],
            event_progress: [],
            event_pause: [],
            event_seeking: [],
            event_seeked: [],
            event_ended: [],
            event_stalled: [],
            event_waiting: [],
            event_canplay: []
        }

        const ret = SaltTransform.generateEventHistory(video);

        assert.equal(video.event_play.length, ret.length);

        ret.forEach((e, i) => {

            assert.equal(e.type, "play");
            assert.equal(e.time.highRes, v[i].time);
            assert.equal(e.time.dateTime, v[i].date);
            assert.equal(e.time.playTime, v[i].play);
            assert.equal(e.time.playPos, v[i].pos);
        });
    });

    it("empty object", async () => {

        const ret = SaltTransform.generateEventHistory({});
        assert.equal(ret.length, 0);
    });

    it("empty field", async () => {

        const v = [{
            // time: 77737.88500006776,
            dateTime: 1575450590919.0,
            playPos: 0.072406,
            playTime: 0.428
        }, {
            time: 78068.65500006825,
            // dateTime: 1575450591250.0,
            playPos: 0.403124,
            playTime: 0.759
        }, {
            time: 79126.47999997716,
            dateTime: 1575450592308.0,
            // playPos: 1.461028,
            playTime: 1.817
        }, {
            time: 79126.47999997718,
            dateTime: 1575450592309.0,
            playPos: 1.461030,
            // playTime: 1.820
        }];

        const video = {
            event_play: [v[3], v[2], v[1], v[0]],
            event_progress: [],
            event_pause: [],
            event_seeking: [],
            event_seeked: [],
            event_ended: [],
            event_stalled: [],
            event_waiting: [],
            event_canplay: []
        }

        const ret = SaltTransform.generateEventHistory(video);
        assert.equal(ret.length, 0);
    });

    afterEach(async () => {

    });
});


describe("SaltTransform generateDropHistory test", () => {

    const prev = {
        totalVideoFrames: 121,
        droppedVideoFrames: 0,
        creationTime: 82549.66500005685,
        creationDate: 1575450594744.0,
        deltaTotalVideoFrames: 30,
        deltaDroppedVideoFrames: 0,
        deltaTime: 1000.0449999934062,
    };

    const sample = [{
        totalVideoFrames: 151,
        droppedVideoFrames: 0,
        creationTime: 82549.66500005685,
        creationDate: 1575450595744.0,
        deltaTotalVideoFrames: 30,
        deltaDroppedVideoFrames: 0,
        deltaTime: 1000.0449999934062,
    }, {
        totalVideoFrames: 181,
        droppedVideoFrames: 0,
        creationTime: 83557.46999999974,
        creationDate: 1575450596742.0,
        deltaTotalVideoFrames: 30,
        deltaDroppedVideoFrames: 0,
        deltaTime: 1007.8049999428913,
    }, {
        totalVideoFrames: 211,
        droppedVideoFrames: 1,
        creationTime: 84558.75000008382,
        creationDate: 1575450597746.0,
        deltaTotalVideoFrames: 30,
        deltaDroppedVideoFrames: 0,
        deltaTime: 1001.2800000840798
    }];

    const next = {
        totalVideoFrames: 241,
        droppedVideoFrames: 1,
        creationTime: 85558.75000008382,
        creationDate: 1575450598746.0,
        deltaTotalVideoFrames: 30,
        deltaDroppedVideoFrames: 0,
        deltaTime: 1001.2800000840798
    }

    beforeEach(async () => {

    });

    it("success1", async () => {

        const quality = sample;
        const ret = SaltTransform.generateDropHistory(quality, []);

        assert.equal(ret.length, 1);
        assert.equal(ret[0].totalFrames, sample[2].totalVideoFrames);
    });

    it("success2", async () => {

        const quality = [{ ...sample[1] }, { ...sample[0] }, { ...sample[2] }];
        quality.forEach(e => { e.droppedVideoFrames += 1 });
        const ret = SaltTransform.generateDropHistory(quality, []);

        assert.equal(ret.length, 2);
        assert.equal(ret[0].totalFrames, sample[0].totalVideoFrames);
    });

    it("success3", async () => {

        const quality = [{ ...sample[1] }, { ...sample[0] }, { ...sample[2] }];
        quality.forEach(e => { e.droppedVideoFrames += 1 });

        const ret = SaltTransform.generateDropHistory(quality, [{
            time: prev.creationDate,
            droppedFrames: prev.droppedVideoFrames + 1,
            totalFrames: prev.totalVideoFrames
        }]);

        assert.equal(ret.length, 2);
        assert.equal(ret[0].totalFrames, prev.totalVideoFrames);
        assert.equal(ret[1].totalFrames, sample[2].totalVideoFrames);
    });

    it("success4", async () => {
        const pa = [{ ...prev }, { ...sample[1] }, { ...sample[0] }, { ...sample[2] }];
        const p = SaltTransform.generateDropHistory(pa, []);
        assert.equal(p.length, 1);
        assert.equal(p[0].totalFrames, sample[2].totalVideoFrames);

        const n = [{ ...next }]
        const ret = SaltTransform.generateDropHistory(n, p);

        assert.equal(ret.length, 2);
        assert.equal(ret[0].totalFrames, sample[2].totalVideoFrames);
        assert.equal(ret[1].totalFrames, next.totalVideoFrames);
    });

    it("empty object1", async () => {

        const ret = SaltTransform.generateDropHistory([], []);

        assert.equal(ret.length, 0);
    });

    it("empty object2", async () => {

        const ret = SaltTransform.generateDropHistory([], [{
            time: prev.creationDate,
            droppedFrames: prev.droppedVideoFrames,
            totalFrames: prev.totalVideoFrames
        }]);

        assert.equal(ret.length, 1);
    });

    it("empty field", async () => {

        const quality = [{ ...sample[1] }, { ...sample[0] }, { ...sample[2] }];
        quality.forEach((e, i) => {
            if (i !== 2) {
                delete e.creationDate;
                delete e.droppedVideoFrames;
            }
        });
        const ret = SaltTransform.generateDropHistory(quality, []);

        assert.equal(ret.length, 1);
        assert.equal(ret[0].totalFrames, sample[2].totalVideoFrames);
    });

    afterEach(async () => {

    });
});

describe("SaltTransform generatePlayList test", () => {

    const sample = [{
        representationId: "136",
        bps: 1352540,
        videoWidth: 1280,
        videoHeight: 720,
        container: "mp4",
        codec: "avc1.4d401f",
        fps: 30,
        chunkDuration: 5000,
        serverIp: "r4---sn-nvoxu-ioqel.googlevideo.com"
    }, {
        representationId: "247",
        bps: 1527429,
        videoWidth: 1280,
        videoHeight: 720,
        container: "webm",
        codec: "vp9",
        fps: 30,
        chunkDuration: 5000,
        serverIp: "r4---sn-nvoxu-ioqel.googlevideo.com"
    }, {
        representationId: "135",
        bps: 874617,
        videoWidth: 854,
        videoHeight: 480,
        container: "mp4",
        codec: "avc1.4d401f",
        fps: 30,
        chunkDuration: 5000,
        serverIp: "r4---sn-nvoxu-ioqel.googlevideo.com"
    }, {
        representationId: "249",
        bps: 54316,
        videoWidth: -1,
        videoHeight: -1,
        container: "webm",
        codec: "opus",
        fps: -1,
        chunkDuration: 5000,
        serverIp: "r4---sn-nvoxu-ioqel.googlevideo.com"
    }];

    beforeEach(async () => {

    });

    it("success", async () => {

        const ret = SaltTransform.generatePlayList(sample);

        assert.equal(ret.length, sample.length);

        ret.forEach((e, i) => {
            assert.equal(e.id, sample[i].representationId);
            assert.equal(e.resolution.height, sample[i].videoHeight);
            assert.equal(e.resolution.width, sample[i].videoWidth);
            assert.equal(e.container, sample[i].container);
            if (e.resolution.height === -1 && e.resolution.width === -1) {
                assert.equal(e.audioCodec, sample[i].codec);
                assert.equal(e.audioTargetBitrate, sample[i].bps);
            } else {
                assert.equal(e.videoCodec, sample[i].codec);
                assert.equal(e.videoTargetBitrate, sample[i].bps);
            }
        });
    });

    it("empty object", async () => {

        const ret = SaltTransform.generatePlayList([]);

        assert.equal(ret.length, 0);
    });

    afterEach(async () => {

    });
});

describe("SaltTransform generateThroughputHistory test", () => {

    const sample = [{
        downloadTime: 231,
        throughput: 6656183,
        downloadSize: 192605,
        start: 1575450576069.0,
        startUnplayedBufferSize: 0,
        end: 1575450576301.0,
        endUnplayedBufferSize: 0,
        bitrate: 761081,
        representationId: "244"
    }, {
        downloadTime: 148,
        throughput: 8216107,
        downloadSize: 153025,
        start: 1575450576663.0,
        startUnplayedBufferSize: 0,
        end: 1575450576812.0,
        endUnplayedBufferSize: 0,
        bitrate: 761081,
        representationId: "244"
    }, {
        downloadTime: 38,
        throughput: 32032944,
        downloadSize: 152657,
        start: 1575450576794.0,
        startUnplayedBufferSize: 0,
        end: 1575450576833.0,
        endUnplayedBufferSize: 0,
        bitrate: 761081,
        representationId: "244"
    }, {
        downloadTime: 72,
        throughput: 56858666,
        downloadSize: 511728,
        start: 1575450576835.0,
        startUnplayedBufferSize: 57546,
        end: 1575450576908.0,
        endUnplayedBufferSize: 57546,
        bitrate: 761081,
        representationId: "244"
    }]

    beforeEach(async () => {

    });

    it("success1", async () => {

        const ret = SaltTransform.generateThroughputHistory(sample);

        assert.equal(ret.length, sample.length);

        ret.forEach((e, i) => {
            assert.equal(e.dlTime, sample[i].start);
            assert.equal(e.throughput, sample[i].throughput);
            assert.equal(e.rtt, sample[i].end - sample[i].start);
        });
    });

    it("success2", async () => {

        const history = [{ ...sample[0] }, { ...sample[0] }, { ...sample[1] },
        { ...sample[1] }, { ...sample[2] }, { ...sample[2] }, { ...sample[3] }, { ...sample[3] }];

        const ret = SaltTransform.generateThroughputHistory(history);

        assert.equal(ret.length, sample.length);

        ret.forEach((e, i) => {
            assert.equal(e.dlTime, sample[i].start);
            assert.equal(e.throughput, sample[i].throughput);
            assert.equal(e.rtt, sample[i].end - sample[i].start);
        });
    });

    it("success3", async () => {

        const history = [{ ...sample[3] }, { ...sample[3] }, { ...sample[2] },
        { ...sample[2] }, { ...sample[1] }, { ...sample[1] }, { ...sample[0] }, { ...sample[0] }];

        const ret = SaltTransform.generateThroughputHistory(history);

        assert.equal(ret.length, sample.length);

        ret.forEach((e, i) => {
            assert.equal(e.dlTime, sample[i].start);
            assert.equal(e.throughput, sample[i].throughput);
            assert.equal(e.rtt, sample[i].end - sample[i].start);
        });
    });

    it("empty object", async () => {

        const ret = SaltTransform.generateThroughputHistory([]);

        assert.equal(ret.length, 0);
    });

    it("empty field", async () => {

        const history = [{ ...sample[0] }, { ...sample[1] }, { ...sample[2] }, { ...sample[3] }];
        history.forEach(e => { delete e.start })

        const ret = SaltTransform.generateThroughputHistory(history);

        assert.equal(ret.length, 0);
    });

    afterEach(async () => {

    });
});

describe("SaltTransform generateRepresentationHistory test", () => {

    const sample = [
        {
            creationDate: 1575450500000.0,
            representation: {
                video: "11",
                audio: "22"
            },
        }, {
            creationDate: 1575450511111.0,
            representation: {
                video: "33",
                audio: "44"
            },
        }, {
            creationDate: 1575450522222.0,
            representation: {
                video: "55",
                audio: "66"
            },
        }
    ];

    beforeEach(async () => {

    });

    it("success1", async () => {

        const ret = SaltTransform.generateRepresentationHistory(sample, {});

        assert.equal(ret.length, sample.length);

        ret.forEach((e, i) => {
            assert.equal(e.video, sample[i].representation.video);
            assert.equal(e.audio, sample[i].representation.audio);
            assert.equal(e.time, sample[i].creationDate);
        });
    });

    it("continue", async () => {

        const ret = SaltTransform.generateRepresentationHistory(sample, {
            video: "11",
            audio: "22"
        });

        assert.equal(ret.length, sample.length - 1);

        ret.forEach((e, i) => {
            assert.equal(e.video, sample[i + 1].representation.video);
            assert.equal(e.audio, sample[i + 1].representation.audio);
            assert.equal(e.time, sample[i + 1].creationDate);
        });
    });


    it("empty object", async () => {

        const ret = SaltTransform.generateRepresentationHistory([], {});

        assert.equal(ret.length, 0);
    });


    it("empty field", async () => {

        const history = [{ ...sample[0] }, { ...sample[1] }, { ...sample[2] }];
        history.forEach(e => { delete e.creationDate })

        const ret = SaltTransform.generateRepresentationHistory(history, {});

        assert.equal(ret.length, 0);
    });

    afterEach(async () => {

    });
});


describe("SaltTransform generateCmHistory test", () => {

    const sample = [{
        type: "cm",
        time: 1575450576879.0
    }, {
        type: "main",
        time: 1575450590491.0
    }];

    beforeEach(async () => {

    });

    it("success1", async () => {

        const { val, ctx } = SaltTransform.generateCmHistory(sample, {});

        assert.equal(val.length, 1);
        assert.equal(true, Object.keys(ctx).length === 0 && ctx.constructor === Object);

        assert.equal(val[0].duration, sample[1].time - sample[0].time);
        assert.equal(val[0].startTime, sample[0].time);
        assert.equal(val[0].endTime, sample[1].time);
    });

    it("continue1", async () => {

        let { val, ctx } = SaltTransform.generateCmHistory([{ ...sample[0] }], {});

        assert.equal(val.length, 0);
        assert.equal(ctx.type, sample[0].type);
        assert.equal(ctx.time, sample[0].time);

        ({ val, ctx } = SaltTransform.generateCmHistory([{ ...sample[1] }], ctx));
        assert.equal(val.length, 1);
        assert.equal(true, Object.keys(ctx).length === 0 && ctx.constructor === Object);

        assert.equal(val[0].duration, sample[1].time - sample[0].time);
        assert.equal(val[0].startTime, sample[0].time);
        assert.equal(val[0].endTime, sample[1].time);
    });

    it("not end", async () => {

        const { val, ctx } = SaltTransform.generateCmHistory([{ ...sample[0] }, { ...sample[0] }, { ...sample[0] }, { ...sample[0] }], {});

        assert.equal(val.length, 0);
        assert.equal(ctx.type, sample[0].type);
        assert.equal(ctx.time, sample[0].time);
    });

    it("not start", async () => {

        const { val, ctx } = SaltTransform.generateCmHistory([{ ...sample[1] }, { ...sample[1] }, { ...sample[1] }, { ...sample[1] }], {});

        assert.equal(val.length, 0);
        assert.equal(true, Object.keys(ctx).length === 0 && ctx.constructor === Object);
    });

    it("empty object", async () => {

        const { val, ctx } = SaltTransform.generateCmHistory([], {});

        assert.equal(val.length, 0);
        assert.equal(true, Object.keys(ctx).length === 0 && ctx.constructor === Object);
    });


    it("empty field", async () => {

        const history = [{ ...sample[0] }, { ...sample[1] }];
        history.forEach(e => { delete e.type })

        const { val, ctx } = SaltTransform.generateCmHistory(history, {});

        assert.equal(val.length, 0);
        assert.equal(true, Object.keys(ctx).length === 0 && ctx.constructor === Object);
    });

    afterEach(async () => {

    });
});

describe("SaltTransform.prototype.create test", () => {
    const saltTransform = new SaltTransform();
    const inputJson = require("../test-data/sodium-sample.json");
    const output = saltTransform.create(inputJson);
    it("output.session.type", () => expect(["social", "personal"]).to.include(output.session.type));
});

describe("SaltTransform.prototype.create test 2", () => {
    const saltTransform = new SaltTransform();
    const inputJson = require("../test-data/sodium-sample2.json");
    const output = saltTransform.create(inputJson);
    it("output.session.type", () => expect(["social", "personal"]).to.include(output.session.type));
});
