# sodium ログ変形用スクリプト

sodium.js から送られてくる fluentd のログファイルをデータを変形し、解析用の DB に登録、公開用ログデータ生成を行う

## 実行環境

- Node v12.16.0

## インストール

```bash
npm i
```

## 実行

```bash
$  node app.js -help
Usage: app [options] [command]

Options:
  -v, --verbose                                 verbosity that can be increased
      --opendata                                公開用データの作成
      --debugFile                               salt DB に登録する内容をファイル出力
      --outdir [DIRECTORY]                      ファイルの出力先 (default: ".")
      --withoutMongo                            Mongo DB へ登録を行わない dir モードと併用することはできない
      --ua [PATTERN]                            ユーザーエージェントの正規表現 (default: "^Mozilla\\/5.0 \\([-0-9A-Za-z._ ]+;[-0-9A-Za-z._ ]+(;[-0-9A-Za-z/._ ]+)?\\) AppleWebKit\\/[0-9.]+ \\(KHTML, like Gecko\\) Chrome\\/[0-9.]+ (Mobile )?Safari\\/[0-9.]+( (Vivaldi|Edg)\\/[0-9.]+)?$")
      --minViewcount [MIN_VALUE]                フィルタを行う最小視聴回数 (default: 100)
      --fluentFormat [STRING]                   fluent ログのフォーマットの正規表現 (default: "^(\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\+\\d{2}:\\d{2})\\s+(\\S*)\\s+({.*})$")
  -g, --gzip                                    入力ファイルがgzipで圧縮されている場合指定
      --withoutGzip                             公開用出力ファイルを圧縮しない
      --mongoURL [URL]                          Mongo DBのURL (default: "mongodb://localhost:27017")
      --mongoDB [DB_NAME]                       DBの名前 (default: "sodium")
      --mongoSaltCollection [COLLECTION_NAME]   salt コレクションの名前 (default: "salt")
      --mongoBatchCollection [COLLECTION_NAME]  batch コレクションの名前 (default: "batch")
      --terminal [PATTERN]                      アンドロイド端末名の正規表現 (default: "Android [0-9.]+;([-0-9A-Za-z/._ ]+)\\)")
      --mask [STRING]                           端末名を置き換える文字列 (default: "XXX")
      --ignoreDays [DAYS]                       dir のときに設定した日より古いファイルは無視する (default: 7)
      --sessionMask [REGEXP]                    ボットセッションの正規表現 (default: "sodium|deadbeef-dead-beef-dead-beefdeadbeef|webdino-jetson-1\\.photo\\.webdino\\.org|webdino-jetson-2\\.photo\\.webdino\\.org|docker\\.io\\/videomark\\/sodium-bot\\:v1\\.0\\.0-f")
      --sessionMaskSeed <STRING>                UUIDの生成種 16byteのhex文字列
  -V, --version                                 output the version number
  -h, --help                                    output usage information

Commands:
  file <file>                                   file interface
  dir <dir>                                     directory interface


```

- サブコマンド

| command | args      | comment                |
| ------- | --------- | ---------------------- |
| file    | file_name | 処理対象のファイル     |
| dir     | dir_name  | 監視を行うディレクトリ |

## 公開用ファイル

opendata オプションを指定すると、公開用のファイルを生成します。

作成するファイルは、処理対象のファイル名の 2 つ目の . の後ろに \_co, \_soc を追加したファイル名になります。拡張子部分は、log.gz になり、withoutGzip をつけた場合、log になります。

### ファイル名の例

入力ファイル

sodium.20200610_0.log.gz

|          | 指定なし                     | withoutGzip               |
| -------- | ---------------------------- | ------------------------- |
| 協力会社 | sodium.20200610_0_co.log.gz  | sodium.20200610_0_co.log  |
| 学会     | sodium.20200610_0_soc.log.gz | sodium.20200610_0_soc.log |

出力先のディレクトリは、outdir オプションで指定します。指定しない場合、カレントディレクトリになります。

## 使用例

### ディレクトリを監視

ディレクトリを監視して公開用ファイルの生成、salt DB の登録を行う。

```bash
node app.js --opendata --sessionMaskSeed 1234567890123456 --outdir dest dir watch
```

上記のオプションを付けた場合、watch ディレクトリにあるファイルを監視し追加されたファイルを処理します。
dest ディレクトリに生成した公開用ファイルを出力します。

監視するディレクトリにあるファイルの処理対象は以下になります。

- file である(再帰的な監視は行わない)
- ファイル名の先頭が sodium である
- 作成されて ignoreDays で指定した日数を経過していない

また、対象のファイルが圧縮されているかどうかの判定をファイル名で行います。監視モードで動作する場合、gzip オプションは無視します。

処理が終わったファイルのパスは、Mongo DB の sodium.batch に追加されます。そのため、DB を操作しない限り同じファイルを対象にはしません。
salt のデータは、sodium.salt に追加されます。

### ファイルを指定して公開用ファイルを生成

ファイルを指定して DB への登録を行わず公開用ファイルを生成を行う。

```bash
node app.js -g --opendata --sessionMaskSeed 1234567890123456 --withoutMongo --outdir dest file watch/sodium.20200610_0.log.gz
```

公開用ファイルを以下に作成します。

|          | 生成するファイル                  |
| -------- | --------------------------------- |
| 協力会社 | dest/sodium_20200610_0_co.log.gz  |
| 学会     | dest/sodium_20200610_0_soc.log.gz |

## 対象外のデータ

- json データではない
- location (URL)が含まれていない
- UserAgent が含まれていない
- UserAgent が Chrome とその互換ブラウザ(Vivaldi, Brave, Chromium Edge)のもの(オプションで指定した正規表現)にマッチしない

## マスク、置き換え、または、取り除くデータ

- 分析用ログデータ用の処理
  - 視聴数の少ない YouTube の URL の末尾部分
    - 例: <https://www.youtube.com/watch?v=7qTxcaEcz-g> -> <https://www.youtube.com>
- [オープンデータ](https://vm.webdino.org/opendata)用の処理
  - IP アドレスを取り除く
  - サービス名
  - 動画 URL(location)を取り除く
  - Android 端末名を置き換える
    - Android 端末名の置き換え後の文字列は、--mask で指定する。デフォルトは 'XXX'
  - サービス名が特定できるドメイン部分を置き換える
    - `serverIp`、 `domainName` をマスクするドメイン部分を以下のルールで置き換え
      - 1 つめの . までを長いハッシュ (MD5 hex 上位 16 桁)
      - それ以降を 短いハッシュ (MD5 hex 上位 8 桁)
    - 上記の 2 つを . でつないだ文字列

## 対応表

|       |            |                 |                       |               | type           | sodium.js                                   | comment                                                                                                                                                                                                                                                             |
| :---- | :--------- | :-------------- | :-------------------- | :------------ | -------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| salt  |            |                 |                       |               |                |                                             |                                                                                                                                                                                                                                                                     |
| \| -- | \_id       |                 |                       |               | string         | -                                           | MongoDB の ID                                                                                                                                                                                                                                                       |
| \| -- | id         |                 |                       |               | string         | video.property.uuid                         | ビデオ ID                                                                                                                                                                                                                                                           |
| \| -- | connection |                 |                       |               |                |                                             |                                                                                                                                                                                                                                                                     |
| \|    | \| --      | type            |                       |               | string         | netinfo.type                                | デバイスがネットワーク通信に使用している接続の種類(bluetooth、cellular、ethernet、none、wifi、wimax、other、unknown) 取得出来ない場合は、null \*Network Information API より取得した情報                                                                            |
| \|    | \| --      | effectiveType   |                       |               | string         | netinfo.effectiveType                       | 有効なタイプ(slow-2g、2g、3g、4g) のいずれかのタイプを返します。 この値は、直近の RTT、downlink の値を使用して決定されます 取得出来ない場合は、null \*Network Information API より取得した情報                                                                      |
| \|    | \| --      | downlink        |                       |               | number         | netinfo.downlink                            | 下り速度(Mbps) \_ 25kbps で丸めた値 取得出来ない場合は、null \_Network Information API より取得した情報                                                                                                                                                             |
| \|    | \| --      | downlinkMax     |                       |               | number         | netinfo.downlinkMax                         | 最大下り速度(Mbps) 取得出来ない場合は、null \*Network Information API より取得した情報                                                                                                                                                                              |
| \|    | \| --      | rtt             |                       |               | number         | netinfo.rtt                                 | RTT 25msec で丸めた値 取得出来ない場合は、null                                                                                                                                                                                                                      |
| \|    | \| --      | apn             |                       |               | string         | netinfo.apn                                 | アクセスポイント 取得出来ない場合は、null                                                                                                                                                                                                                           |
| \|    | \| --      | plmn            |                       |               | string         | netinfo.plmn                                | ルーティングエリア 取得出来ない場合は、null                                                                                                                                                                                                                         |
| \|    | \| --      | sim             |                       |               | string         | netinfo.sim                                 | SIM 取得出来ない場合は、null                                                                                                                                                                                                                                        |
| \| -- | network    |                 |                       |               |                |                                             |                                                                                                                                                                                                                                                                     |
| \|    | \| --      | serverHost      |                       |               | string         | location                                    | 計測対象ページのホスト名                                                                                                                                                                                                                                            |
| \|    | \| --      | serverIp        |                       |               | string         | locationIp                                  | 計測対象ページ IP アドレス                                                                                                                                                                                                                                          |
| \|    | \| --      | clientIp        |                       |               | string         | REMOTE_ADDR                                 | クライアント IP アドレス                                                                                                                                                                                                                                            |
| \|    | \| --      | clientLocation  |                       |               |                |                                             |                                                                                                                                                                                                                                                                     |
| \|    | \| --      | \| --           | country               |               | string         | -                                           | クライアントの国 (MaxMind 推定)                                                                                                                                                                                                                                     |
| \|    | \| --      | \| --           | subdivision           |               | string         | -                                           | クライアントの都道府県 (MaxMind 推定)                                                                                                                                                                                                                               |
| \|    | \| --      | isp             |                       |               | string         | -                                           | クライアントの ISP (MaxMind 推定)                                                                                                                                                                                                                                   |
| \|    | \| --      | asn             |                       |               | string         | -                                           | クライアントの Autonomous System Number (MaxMind 推定)                                                                                                                                                                                                              |
| \| -- | session    |                 |                       |               |                |                                             |                                                                                                                                                                                                                                                                     |
| \|    | \| --      | \*lastSend      |                       |               | null \| Date   | -                                           | 最終送信日時。デフォルトは null。このフィールドの値は外部の sodium コレクションの `last_send` フィールドから移行するため本スクリプトでは書き込まれません。                                                                                                          |
| \|    | \| --      | location        |                       |               | string         | location                                    | 視聴ページの URL                                                                                                                                                                                                                                                    |
| \|    | \| --      | \*qoe           |                       |               | null \| number | -                                           | QoE 値。デフォルトは null。このフィールドの値は外部の sodium コレクションの `qoe` フィールドから移行するため本スクリプトでは書き込まれません。                                                                                                                      |
| \|    | \| --      | sodiumSessionId |                       |               | string         | session                                     | セッション ID                                                                                                                                                                                                                                                       |
| \|    | \| --      | sodiumVideoId   |                       |               | string         | video.property.uuid                         | ビデオ ID                                                                                                                                                                                                                                                           |
| \|    | \| --      | type            |                       |               | string         | -                                           | セッション種別 (social, personal)。デフォルトは social。sesison の値は UUIDv4 であれば social とする。                                                                                                                                                              |
| \|    | \| --      | \*orientation   |                       |               | string         | 未実装                                      | デバイスの表示状態                                                                                                                                                                                                                                                  |
| \|    | \| --      | userAgent       |                       |               |                |                                             |                                                                                                                                                                                                                                                                     |
| \|    | \| --      | \| --           | browser               |               | string         | userAgent                                   | クライアントのブラウザ                                                                                                                                                                                                                                              |
| \|    | \| --      | \| --           | original              |               | string         | userAgent                                   | UA 文字列全体                                                                                                                                                                                                                                                       |
| \|    | \| --      | \| --           | os                    |               | string         | userAgent                                   | クライアントの OS                                                                                                                                                                                                                                                   |
| \| -- | video      |                 |                       |               |                |                                             |
| \|    | \| --      | videoId         |                       |               | string         | video.property.holderId,                    | サービス提供元が付加した ID                                                                                                                                                                                                                                         |
| \|    | \| --      | duration        | duration              |               | number         | video.property.mediaSize                    | 再生中の動画の長さ(秒)                                                                                                                                                                                                                                              |
| \|    | \| --      | representations |                       |               |                |                                             |                                                                                                                                                                                                                                                                     |
| \|    | \|         | \| --           | \*id                  |               | number         | video.play_list_info.representationId       | プレイリストの ID                                                                                                                                                                                                                                                   |
| \|    | \|         | \| --           | resolution            |               |                |                                             |                                                                                                                                                                                                                                                                     |
| \|    | \|         | \|              | \| --                 | height        | number         | video.play_list_info.videoHeight            | 高さ                                                                                                                                                                                                                                                                |
| \|    | \|         | \|              | \| --                 | width         | number         | video.play_list_info.videoWidth             | 幅                                                                                                                                                                                                                                                                  |
| \|    | \|         | \| --           | container             |               | string         | video.play_list_info.container              | 動画のコンテナ                                                                                                                                                                                                                                                      |
| \|    | \|         | \| --           | videoCodec            |               | string         | video.play_list_info.codec                  | 動画のコーデック                                                                                                                                                                                                                                                    |
| \|    | \|         | \| --           | audioCodec            |               | string         | video.play_list_info.codec                  | 音声のコーデック                                                                                                                                                                                                                                                    |
| \|    | \|         | \| --           | videoTargetBitrate    |               | number         | video.play_list_info.bps                    | 動画のビットレート                                                                                                                                                                                                                                                  |
| \|    | \|         | \| --           | audioTargetBitrate    |               | number         | video.play_list_info.bps                    | 音声のビットレート                                                                                                                                                                                                                                                  |
| \|    | \|         | \| --           | domainName            |               | string         | video.play_list_info.serverIp               | CDN サーバドメイン _video.play_list_info.serverIp を使用しているのは、TQAPI Server 対応時に IP アドレスを入れるフィールド(serverIp)として作成したが IP アドレスを取得することができず CDN のドメイン名を入れて実装した。そのため、この値を domainName とし使用する_ |
| \|    | \| --      | playHistory     |                       |               |                |                                             |                                                                                                                                                                                                                                                                     |
| \|    | \|         | \| --           | startTime             |               | number         | video.property.playStartTime                | 再生開始時刻                                                                                                                                                                                                                                                        |
| \|    | \|         | \| --           | holiday               |               | boolean        | -                                           | 日本の休日フラグ (holiday_jp 推定)                                                                                                                                                                                                                                  |
| \|    | \|         | \| --           | endTime               |               | number         | video.property.playEndTime                  | 再生終了時刻                                                                                                                                                                                                                                                        |
| \|    | \|         | \| --           | throughputHistory     |               |                |                                             |
| \|    | \|         | \|              | \| --　               | dlTime        | number         | video.throughput_info.start                 | ダウンロード開始時刻                                                                                                                                                                                                                                                |
| \|    | \|         | \|              | \| --                 | throughput    | number         | video.throughput_info.bps                   | スループット(bps)                                                                                                                                                                                                                                                   |
| \|    | \|         | \|              | \| --                 | rtt           | number         | video.throughput_info.start, end            | 応答時間(秒)                                                                                                                                                                                                                                                        |
| \|    | \|         | \| --           | eventHistory          |               |                |                                             |                                                                                                                                                                                                                                                                     |
| \|    | \|         | \|              | \| --                 | type          | string         | event.name                                  | イベント種別                                                                                                                                                                                                                                                        |
| \|    | \|         | \|              | \| --                 | highRes       | number         | event.time                                  | イベット発生時刻 高精度タイムスタンプ                                                                                                                                                                                                                               |
| \|    | \|         | \|              | \| --                 | date          | number         | event.dateTime                              | イベット発生時刻                                                                                                                                                                                                                                                    |
| \|    | \|         | \|              | \| --                 | play          | number         | event.playTime                              | 再生開始からの経過時間                                                                                                                                                                                                                                              |
| \|    | \|         | \|              | \| --                 | pos           | number         | event.playPos                               | 再生位置                                                                                                                                                                                                                                                            |
| \|    | \|         | \| --           | representationHistory |               |                |                                             |
| \|    | \|         | \|              | \| --                 | video         | string         | video.playback_quality.representation.video | Video Representation ID                                                                                                                                                                                                                                             |
| \|    | \|         | \|              | \| --                 | audio         | string         | video.playback_quality.representation.audio | Audio Representation ID                                                                                                                                                                                                                                             |
| \|    | \|         | \|              | \| --                 | videoHeight   | number         | -                                           | representations がある場合、該当の resolution の height の値、ない場合は、video.property.videoHeight の値                                                                                                                                                           |
| \|    | \|         | \|              | \| --                 | videoWidth    | number         | -                                           | representations がある場合、該当の resolution の width の値、ない場合は、video.property.videoWidth の値                                                                                                                                                             |
| \|    | \|         | \|              | \| --                 | time          | number         | video.playback_quality.creationDate         | resolution の値が変化した時刻                                                                                                                                                                                                                                       |
| \|    | \|         | \| --           | frameDropHistory      |               |                |                                             |
| \|    | \|         | \|              | \| --                 | time          | number         | video.playback_quality.creationTime         | ドロップ検出時刻 高精度タイムスタンプ                                                                                                                                                                                                                               |  |
| \|    | \|         | \|              | \| --                 | droppedFrames | number         | video.playback_quality.droppedVideoFrames   | ドロップ数                                                                                                                                                                                                                                                          |  |
| \|    | \|         | \|              | \| --                 | totalFrames   | number         | video.playback_quality.totalVideoFrames     | 描画フレーム数                                                                                                                                                                                                                                                      |  |
| \|    | \| --      | cmHistory       |                       |               |                |                                             |
| \|    | \|         | \| --           | duration              |               | number         | -                                           | cm の再生時間                                                                                                                                                                                                                                                       |  |
| \|    | \|         | \| --           | startTime             |               | number         | video.cmHistory.time                        | cm 開始時刻                                                                                                                                                                                                                                                         |  |
| \|    | \|         | \| --           | endTime               |               | number         | video.cmHistory.time                        | cm 終了時刻                                                                                                                                                                                                                                                         |  |

Network Information API より取得した情報 <http://wicg.github.io/netinfo/#networkinformation-interface>

上記のページより抜粋

Table of maximum downlink speeds

| Connection type | Underlying connection technology | Generation or Version | Max downlink speed (Mbit/s) |
| --------------- | -------------------------------- | --------------------- | --------------------------- |
| wimax           | WiMAX 1                          | rel 1                 | 37                          |
| wimax           | WiMAX 1.5                        | rel 1.5               | 141                         |
| wimax           | WiMAX 2                          | rel 2                 | 365                         |
| cellular        | GSM                              | 2G                    | 0.01                        |
| cellular        | IDEN                             | 2G                    | 0.064                       |
| cellular        | CDMA                             | 2G                    | 0.115                       |
| cellular        | 1xRTT                            | 2.5G                  | 0.153                       |
| cellular        | GPRS                             | 2.5G                  | 0.237                       |
| cellular        | EDGE                             | 2.75G                 | 0.384                       |
| cellular        | UMTS                             | 3G                    | 2                           |
| cellular        | EVDO Rev 0                       | 3.5G                  | 2.46                        |
| cellular        | EVDO Rev A                       | 3.5G                  | 3.1                         |
| cellular        | HSPA                             | 3.5G                  | 3.6                         |
| cellular        | EVDO Rev B                       | 3.75G                 | 14.7                        |
| cellular        | HSDPA                            | 3.75G                 | 14.3                        |
| cellular        | HSUPA                            | 3.75G                 | 14.4                        |
| cellular        | EHRPD                            | 3.9G                  | 21                          |
| cellular        | HSPAP                            | 3.9G                  | 42                          |
| cellular        | LTE                              | 4G                    | 100                         |
| cellular        | LTE Advanced                     | 4G                    | 100                         |
| bluetooth       | 1.2                              | 1                     |                             |
| bluetooth       | 2.1 + Enhanced Data Rate (EDR)   | 2.1+EDR               | 3                           |
| bluetooth       | 3.0 + High Speed (HS)            | 3.0+HS                | 24                          |
| bluetooth       | 4.0 + Bluetooth Low Energy (BLE) | 4.0+BLE               | 1                           |
| ethernet        | Ethernet                         | 10                    | 10                          |
| ethernet        | Fast Ethernet                    | 100                   | 100                         |
| ethernet        | Gigabit Ethernet                 | GigE                  | 1000                        |
| ethernet        | 10-gigabit Ethernet              | 10 GigE               | 10000                       |
| wifi            | b                                | 802.11b               | 11                          |
| wifi            | g                                | 802.11g               | 54                          |
| wifi            | n                                | 802.11n               | 600                         |
| wifi            | ac                               | 802.11ac              | 6933.3                      |
| wifi            | ad                               | 802.11ad              | 7000                        |
| unknown         | unknown                          | unknown               | +Infinity                   |
| none            | none                             | none                  | 0                           |
| other           | other                            | other                 | user agent specific.        |

全体的に dateTime を使うか高精度タイムスタンプを使用するか検討中

## テスト

MongoDB を起動

```sh
docker run --rm -p 27017:27017 mongo
```

テストを実行

```sh
npm test
```
