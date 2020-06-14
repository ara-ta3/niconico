import * as request from "request-promise-native";
import * as mysql from "promise-mysql";
import * as moment from "moment";
import { JSDOM } from "jsdom";
import { VideoID, ThreadResponseBody, ThreadID, Chat, Video } from "./Contract";
import fetch from "node-fetch";

// TODO lib
export async function sleep(msec: number): Promise<void> {
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
async function fetchVideoFromEmbed(
  videoId: VideoID
): Promise<Omit<Video, "postedAt">> {
  const url = `https://embed.nicovideo.jp/watch/${videoId}`;
  const res = await fetch(url, {
    headers: {
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
      "accept-language": "ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.97 Safari/537.36",
    },
    method: "GET",
  });
  const body = await res.text();
  const page = await new JSDOM(body);
  const propsDom = page.window.document.getElementById("ext-player");
  if (propsDom === undefined || propsDom === null) {
    return Promise.reject(
      new JSInitialWatchDataNotFoundError(
        `ext-player dom is not found. video url = ${url}`,
        videoId
      )
    );
  }
  const jsonString = propsDom.attributes.getNamedItem("data-props").value;
  const json: {
    videoId: string;
    title: string;
    thread: EmbededThread;
  } = JSON.parse(jsonString);
  return {
    id: json.videoId,
    title: json.title,
    threadId: json.thread.id,
  };
}

export async function fetchVideo(videoId: VideoID): Promise<Video> {
  const url = `https://www.nicovideo.jp/watch/${videoId}`;
  const res = await fetch(url, {
    headers: {
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
      "accept-language": "ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7",
      "cache-control": "max-age=0",
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "none",
      "sec-fetch-user": "?1",
      "upgrade-insecure-requests": "1",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.97 Safari/537.36",
    },
    method: "GET",
  });
  const body = await res.text();
  const page = await new JSDOM(body);
  const apiDataDom = page.window.document.getElementById(
    "js-initial-watch-data"
  );
  if (apiDataDom === undefined || apiDataDom === null) {
    let uploadDate = null;
    Array.from(page.window.document.getElementsByTagName("script")).forEach(
      (script) => {
        if (
          script.type !== "application/ld+json" ||
          script.innerText === undefined
        ) {
          return;
        }
        const json: { uploadDate: string } = JSON.parse(script.innerText);
        if (json.uploadDate === undefined) {
          return;
        }

        uploadDate = moment(json.uploadDate, "YYYY-MM-DDTHH:mm:ssZ");
      }
    );
    if (uploadDate === null) {
      return Promise.reject(
        new JSInitialWatchDataNotFoundError(
          `js-initial-watch-data dom is not found. video url = ${url}`,
          videoId
        )
      );
    }

    const partial = await fetchVideoFromEmbed(videoId);
    return {
      ...partial,
      postedAt: uploadDate,
    };
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

interface EmbededThread {
  id: ThreadID;
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
