const assert = require("assert");
const { Readable } = require("stream");

const { beforeEach, describe, it, afterEach } = require("mocha");
const mongodb = require("mongodb");
const config = require("config");

const MongoWritable = require("../src/writable/mongo");

// eslint-disable-next-line no-console, no-unused-vars
const print = console.log;

describe("writable test", () => {

    describe("mongo", () => {

        const url = config.get("output.mongo.url");
        const dbName = config.get("output.mongo.db");
        const collectionName = "test";

        let mw;
        let values;
        let errorValues;
        let client;
        let collection;

        const testFunc = (testData) => {

            return new Promise((resolve) => {

                new Readable({
                    objectMode: true,
                    read() {

                        const v = testData.shift();
                        this.push(v === undefined ? null : v);
                    }
                })
                    .pipe(mw)
                    .on("finish", () => resolve())
                    .on("error", e => reject(e));
            })
        }

        beforeEach(async () => {

            values = [{
                session: {
                    sodiumVideoId: 1
                },
                connection: "connection1",
                network: "network1",
                video: "video1"
            }, {
                session: {
                    sodiumVideoId: 2
                },
                connection: "connection2",
                network: "network2",
                video: "video2"
            }]

            // id not found
            errorValues = [{
                connection: "connection1",
                network: "network1",
                video: "video1"
            }, {
                connection: "connection2",
                network: "network2",
                video: "video2"
            }]

            mw = new MongoWritable({
                mongoURL: url,
                mongoDB: dbName,
                mongoCollection: collectionName
            })

            try {
                client = await mongodb.MongoClient.connect(url, {
                    useNewUrlParser: true,
                    useUnifiedTopology: true
                });

                collection = client.db(dbName).collection(collectionName);

                mw.init(collection);
            } catch (e) {

                assert.fail(e);
            }
        });

        it("OK write mongo", async () => {

            try {

                await testFunc(values);
                const size = await collection.countDocuments();
                assert.equal(size, 2);
            } catch (e) {

                assert.fail(e);
            }

        }).timeout(15000);

        it("NG write mongo", async () => {

            try {

                await testFunc(errorValues);
                const size = await collection.countDocuments();
                assert.equal(size, 0);
            } catch (e) {

                assert.fail(e);
            }
            
        }).timeout(15000);

        afterEach(async () => {

            await collection.deleteMany({});
            await client.close();
            // await mw.close();
        })
    });
});
