const assert = require("assert");
const { Readable } = require("stream");
const { TextEncoder } = require("util");

const { beforeEach, describe, it, afterEach } = require("mocha");
const config = require("config");

const CacheTransform = require("../src/transform/cache");
// const MaskTransform = require("../src/transform/mask");

const utf8Encoder = new TextEncoder();

// eslint-disable-next-line no-console, no-unused-vars
const print = console.log;

describe("transform cache test", () => {

    let cache;

    describe("cache", () => {

        const testFunc = (count, time) => {

            let v = 0;
            return new Promise((resolve) => {

                const r = new Readable({
                    objectMode: true,
                    read() {
                        setTimeout(() => {
                            v += 1;
                            try {
                                if (v < count) {
                                    this.push(v);
                                } else {
                                    this.push(null);
                                }
                            } catch (e) {
                                // do nothing 
                            }
                        }, time);
                    }
                });

                r
                    .pipe(cache)
                    .on("finish", () => {
                        resolve()
                    });

            })
        }

        beforeEach(async () => {
            cache = new CacheTransform();
        });

        it("OK cache", async () => {

            try {

                await Promise.race([
                    testFunc(3, 50),
                    new Promise((resolve) => setTimeout(() => resolve(), 500))
                        .then(() => assert.fail("cache timeout. not available"))
                ]);
            } catch (e) {

                assert.fail(e);
            }
        });

        it("OK cache waiting", async () => {

            try {

                await Promise.race([
                    testFunc(2, 1000)
                        .then(() => assert.fail("cache fire. no waiting")),
                    new Promise((resolve) => setTimeout(() => resolve(), 150))]);
            } catch (e) {

                assert.fail(e);
            }
        });


        afterEach(async () => {

        })
    });
});

