const assert = require("assert");
const { Writable, Transform } = require("stream");
const { TextDecoder } = require("util");

const { beforeEach, describe, it, afterEach } = require("mocha");
const fetch = require("node-fetch");
const config = require("config");

const utf8Decoder = new TextDecoder();

const FileReadable = require("../src/readable/file");
const HttpReadable = require("../src/readable/http");

// eslint-disable-next-line no-console, no-unused-vars
const print = console.log;

describe("readable test", () => {

    describe("file", () => {

        let fr;
        let values;
        const testFunc = (resolve, reject) => {

            fr
                .pipe(new Writable({

                    write(chunk, _encoding, callback) {

                        try {

                            const str = utf8Decoder.decode(chunk);
                            const ret = str.match(new RegExp(config.get("input.file.format")));
                            if (ret)
                                values.push(JSON.parse(ret[3]));
                        } catch (e) {

                            reject(e);
                        } finally {

                            callback();
                        }
                    }
                }))
                .on("finish", () => {

                    resolve();
                });
        }

        const beforeFunc = async (file) => {

            fr = new FileReadable(file, config.get("input.file.format"));

            try {

                await fr.init();
            } catch (e) {

                assert.fail(e);
            }
        }

        beforeEach(async () => {

            values = [];
        });

        it("OK read json-format", async () => {

            await beforeFunc("./test-data/json-format.log");
            await new Promise(testFunc);
            assert.equal(values.length, 2);
        });

        it("NG read no-header-json-format", async () => {

            await beforeFunc("./test-data/no-header-json-format.log");
            await new Promise(testFunc);
            assert.equal(values.length, 0);
        });

        it("NG read unformat", async () => {

            await beforeFunc("./test-data/unformat.log");
            await new Promise(testFunc);
            assert.equal(values.length, 0);
        });

        afterEach(() => {

        })
    });

    describe("http", () => {

        const host = "localhost";
        const port = 3000;

        let hr;
        let values;
        let count;

        const testFunc = (resolve, reject) => {

            hr
                .pipe(new Transform({

                    transform(chunk, _encoding, callback) {

                        try {

                            const str = utf8Decoder.decode(chunk);
                            values.push(JSON.parse(str));
                            this.push(str);
                        } catch (e) {

                            reject(e);
                        } finally {

                            callback();
                        }
                    }
                }))
                .on("data", () => {

                    count += 1;
                    // print(`on [count:${count}, data:${data}]`);

                    if (count === 2)
                        resolve();
                });
        }

        beforeEach(async () => {

            count = 0;
            values = [];

            // print(`http server ${host}:${port}`);

            hr = new HttpReadable(host, port);

            try {

                await hr.init();
            } catch (e) {

                assert.fail(e);
            }
        });

        it("OK read json request", async () => {

            const tasks = [new Promise(testFunc),

            fetch(`http://${host}:${port}`, {
                method: "post",
                body: JSON.stringify({
                    a: "b",
                    c: "d"
                }),
                headers: { "Content-Type": "application/json" },
            }), fetch(`http://${host}:${port}`, {
                method: "post",
                body: JSON.stringify({
                    e: "f",
                    g: "h"
                }),
                headers: { "Content-Type": "application/json" },
            })];

            try {

                await Promise.all(tasks);
            } catch (e) {

                assert.fail(e);
            }

            assert.equal(values.length, 2);
        });

        it("NG read unformat request", async () => {

            const tasks = [new Promise(testFunc),

            fetch(`http://${host}:${port}`, { // request error 
                method: "post",
                body: "unformat",
                headers: { "Content-Type": "application/json" },
            }), fetch(`http://${host}:${port}`, { // headless
                method: "post",
                body: JSON.stringify({
                    e: "f",
                    g: "h"
                }),
            })];

            try {

                await Promise.race(tasks);
            } catch (e) {

                assert.fail(e);
            }

            assert.equal(values.length, 0);
        });

        afterEach(() => {

            hr.close();
        })
    });
});