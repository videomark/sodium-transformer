const fs = require("fs");
const zlib = require("zlib");
const readline = require('readline');
const { Transform } = require("stream");
// const { TextEncoder, TextDecoder } = require("util");

const log4js = require("log4js");
const byline = require("byline");
const { google } = require("googleapis");

// const utf8Encoder = new TextEncoder();
// const utf8Decoder = new TextDecoder();

const logger = log4js.getLogger("app");

const SCOPES = ["https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/drive.metadata.readonly"];
const CREDENTIALS_FILE = "./credentials.json";
const TOKEN_FILE = "./token.json";

const version = "v3";

class DriveReadable extends Transform {

    constructor(id, format) {

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

        this.id = id;
        this.format = format;
    }

    description() {
        return `google drive interface [id:${this.id}]`;
    }

    async init() {

        // eslint-disable-next-line camelcase
        const { installed: { client_secret, client_id, redirect_uris } } = JSON.parse(fs.readFileSync(CREDENTIALS_FILE));

        const auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

        if (fs.existsSync(TOKEN_FILE)) {
            auth.setCredentials(JSON.parse(fs.readFileSync(TOKEN_FILE)));
        } else {
            const authUrl = auth.generateAuthUrl({
                access_type: "offline",
                scope: SCOPES,
            });

            logger.info("Authorize this app by visiting this url:", authUrl);
            const code = await new Promise((resolve) => {
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout,
                });
                rl.question("Enter the code from that page here: ", c => {
                    rl.close();
                    resolve(c)
                });
            });

            const { res: { data: token } } = await auth.getToken(code);
            auth.setCredentials(token);
            fs.writeFileSync(TOKEN_FILE, JSON.stringify(token));
        }

        const drive = google.drive({ version, auth });
        const { data: { name, mimeType } } = await drive.files.get({
            fileId: this.id
        });

        logger.info(`google drive file: name:${name}, mimeType:${mimeType}`);
        const { data } = await drive.files.get({
            fileId: this.id,
            alt: "media"
        }, {
            responseType: "stream"
        });

        if (mimeType === "application/gzip")
            data
                .pipe(zlib.createGunzip())
                .pipe(byline.createStream())
                .pipe(this);
        else
            data
                .pipe(byline.createStream())
                .pipe(this);
    }
}

module.exports = DriveReadable