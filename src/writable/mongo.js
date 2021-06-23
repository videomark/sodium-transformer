const { Writable } = require("stream");

const log4js = require("log4js");

const logger = log4js.getLogger("app");

class MongoWritable extends Writable {

    constructor(options) {

        super({

            objectMode: true,

            write: async (salt, _encoding, callback) => {

                try {
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    await this.update(salt);
                } catch (e) {

                    logger.error(e);
                } finally {

                    callback();
                }
            },

            final: (callback) => {

                callback();
            }
        });
        this.collection = null;

    }

    async init(collection) {
        this.collection = collection;
    }

    async update(salt) {
        /* TODO 現状ではあと勝ちで あとに実行したスクリプトのファイルの内容で上書きされる。
        // 修正したほうが良いがマージ処理を追加した場合データの訂正なので再実行したときに大変になるので
        // 以下のデータをちゃんと使うようになったら修正することにする。
        let ret;
        const [now] = await this.collection.find({ "id": salt.session.sodiumVideoId }).toArray();
        if (now) {
            // update
            console.log("update")
            console.log(now.video.playHistory.throughputHistory)
            console.log(now.video.playHistory.eventHistory)
            console.log(now.video.playHistory.representationHistory)
            console.log(now.video.playHistory.frameDropHistory)
            console.log(now.video.cmHistory)

        } else {
            console.log("insert")
            // insert
            ret = await this.collection.updateOne({
                "id": salt.session.sodiumVideoId,
            }, [
                {
                  "$project": { id: 1, session: 1, "_qoe": "$session.qoe" }
                }, {
                    "$set": {
                        id: "$id",
                        session: salt.session,
                        connection: salt.connection,
                        network: salt.network,
                        video: salt.video,
                    }
                }, {
                    "$set": {
                        "session.qoe": { $ifNull: [ "$_qoe", salt.session.qoe ] }
                    }
                }, {
                    "$unset": [ "_qoe" ]
                }
            ], {
                "upsert": true
            });
        }
        */

        const ret = await this.collection.updateOne({
            "id": salt.session.sodiumVideoId,
        }, [
            {
              "$project": { id: 1, session: 1, "_qoe": "$session.qoe" }
            }, {
                "$set": {
                    id: "$id",
                    session: salt.session,
                    connection: salt.connection,
                    network: salt.network,
                    video: salt.video,
                }
            }, {
                "$set": {
                    "session.qoe": { $ifNull: [ "$_qoe", salt.session.qoe ] }
                }
            }, {
                "$unset": [ "_qoe" ]
            }
        ], {
            "upsert": true
        });

        let method = "";
        if (ret.modifiedCount === 1)
            method = "update";
        else if (ret.upsertedCount === 1)
            method = "insert";
        else
            method = "no change"

        logger.debug(`${method} view[id:${salt.session.sodiumVideoId}]`)
    }
}

module.exports = MongoWritable;
