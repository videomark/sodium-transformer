const http = require("http");
const express = require("express");

const { Readable } = require("stream");
const { TextEncoder } = require("util");

const log4js = require("log4js");

const Utils = require("../utils");

const utf8Encoder = new TextEncoder();

const logger = log4js.getLogger("app");

async function serverSetup(app, host, port) {

    const server = http.createServer(app);

    return new Promise((resolve, reject) => {

        server.listen(port, host);

        server.on("error", error => {

            if (error.syscall !== "listen") {
                reject(error);
            }

            const bind = typeof port === "string"
                ? `Pipe ${port}`
                : `Port ${port}`;

            switch (error.code) {
                case "EACCES":
                    reject(new Error(`${bind} requires elevated privileges`));
                    break;
                case "EADDRINUSE":
                    reject(new Error(`${bind} is already in use`));
                    break;
                default:
                    reject(error);
            }
        });

        server.on("listening", () => {

            resolve(server);
        });

    });
}

module.exports = class HttpReadable extends Readable {

    constructor(host, port) {

        super({
            read: () => { }
        });

        this.port = Utils.normalizePort(port);
        this.host = host;

        this.server = null;
    }

    close() {
        this.server.close();
    }

    description() {
        return `http interface [host:${this.host} port:${this.port}]`;
    }

    async init() {

        const router = express.Router();
        router.get("/", (_req, res) => res.end());
        router.post("/", (req, res, next) => this.post(req, res, next));
        router.post("/", (err, req, res) => res.send(err.message));

        const app = express();
        app.use(log4js.connectLogger(logger));
        app.use(express.json());
        app.use(express.urlencoded({ extended: false }));
        app.use("", router);
        // eslint-disable-next-line no-unused-vars
        app.use((err, req, res, next) => {
            logger.error(err);
            res.status(500).end();
        })

        this.server = await serverSetup(app, this.host, this.port);
    }

    async post(req, res, next) {

        if (!req.is("json"))
            return next(new Error("content-type json and json formated data required"));

        try {
            const str = JSON.stringify(req.body);
            // TODO buffer overflow
            this.push(str);

        } catch (e) {
            // TODO error status
            logger.error(e);
        }

        return res.end();
    }
}

