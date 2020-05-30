import * as request from "request-promise-native";
import * as mysql from "promise-mysql";
import * as moment from "moment";
import { JSDOM } from "jsdom";
import { VideoID, ThreadResponseBody, ThreadID, Chat, Video } from "./Contract";

async function sleep(msec: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, msec));
}

export async function fetchVideoIds(seriesUrl: string): Promise<VideoID[]> {
  const dom = await JSDOM.fromURL(seriesUrl);
  const document = dom.window.document;
  return Array.from(
    document.getElementsByClassName("VideoMediaObject-title")
  ).map((div: any) =>
    div.children[0].attributes["href"].value.replace("/watch/", "")
  );
}

export async function fetchVideo(
  videoId: VideoID,
  count: number = 1
): Promise<Video> {
  const url = `https://www.nicovideo.jp/watch/${videoId}`;
  const res = await request.get(url);
  const page = await new JSDOM(res);
  const apiDataDom = page.window.document.getElementById(
    "js-initial-watch-data"
  );
  if (apiDataDom === undefined || apiDataDom === null) {
    if (count > 3) {
      return Promise.reject(
        new JSInitialWatchDataNotFoundError(
          `js-initial-watch-data dom is not found. video url = ${url}`,
          videoId
        )
      );
    }
    const msec = 1000 * (count * count);
    console.info(
      `failed to find js-initial-watch-data dom. video = ${videoId} count = ${count} wait ${msec} milliseconds`
    );
    await sleep(msec);
    return this.fetchVideo(videoId, count + 1);
  }
  const jsonString = apiDataDom.attributes.getNamedItem("data-api-data").value;
  const json: {
    video: {
      title: string;
      postedDateTime: string;
    };
    thread: Thread;
  } = JSON.parse(jsonString);
  const thread = json.thread;
  return {
    id: videoId,
    title: json.video.title,
    threadId: thread.ids.default,
    postedAt: moment(json.video.postedDateTime, "YYYY/MM/DD HH:mm:ss"),
  };
}

export async function fetchChats(threadId: ThreadID): Promise<Chat[]> {
  const res = await request
    .post("https://nmsg.nicovideo.jp/api.json/", {
      headers: {
        "Content-Type": "text/plain;charset=UTF-8",
      },
      body: `[{"thread_leaves":{"thread":"${threadId}","content":"0-11:100"}}]`,
    })
    .promise();

  const body: ThreadResponseBody[] = JSON.parse(res);
  let chats: Chat[] = [];
  body.forEach((b) => {
    if (b.chat !== undefined) {
      chats.push(b.chat);
    }
  });
  return chats;
}

interface Thread {
  ids: {
    default: ThreadID;
  };
}

export class JSInitialWatchDataNotFoundError extends Error {
  readonly videoId: string;
  constructor(message: string, videoId: string) {
    super(message);
    this.videoId = videoId;
  }
}

export class CommentRepository {
  readonly connection: mysql.Connection;
  constructor(connection: mysql.Connection) {
    this.connection = connection;
  }

  async put(comments: Map<VideoID, Chat[]>): Promise<void> {
    const query =
      "INSERT INTO comments(no, video_id, user_id, content, posted_at) VALUES(?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE content=VALUES(content)";
    comments.forEach((chats, videoId) => {
      chats.forEach((chat) => {
        const date = moment.unix(chat.date);
        this.connection.query(query, [
          chat.no,
          videoId,
          chat.user_id,
          chat.content,
          date.format("YYYY-MM-DDTHH:mm:ss"),
        ]);
      });
    });
  }
}

export class VideoRepository {
  readonly connection: mysql.Connection;
  constructor(connection: mysql.Connection) {
    this.connection = connection;
  }

  async put(videos: Video[]): Promise<void> {
    const query =
      "INSERT INTO videos(id, title, posted_at) VALUES(?, ?, ?) ON DUPLICATE KEY UPDATE title=VALUES(title)";
    videos.forEach((video) => {
      this.connection.query(query, [
        video.id,
        video.title,
        video.postedAt.format("YYYY-MM-DDTHH:mm:ss"),
      ]);
    });
  }
}
