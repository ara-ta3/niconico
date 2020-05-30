import * as request from "request-promise-native";
import { JSDOM } from "jsdom";
import { VideoID, ThreadResponseBody, ThreadID, Chat } from "./Contract";

export async function fetchVideoIds(seriesUrl: string): Promise<VideoID[]> {
  const dom = await JSDOM.fromURL(seriesUrl);
  const document = dom.window.document;
  return Array.from(
    document.getElementsByClassName("VideoMediaObject-title")
  ).map((div: any) =>
    div.children[0].attributes["href"].value.replace("/watch/", "")
  );
}

export async function fetchThreadId(videoId: VideoID): Promise<ThreadID> {
  const url = `https://www.nicovideo.jp/watch/${videoId}`;
  const page = await JSDOM.fromURL(url);
  const apiDataDom = page.window.document.getElementById(
    "js-initial-watch-data"
  );
  if (apiDataDom === undefined || apiDataDom === null) {
    return Promise.reject(
      new JSInitialWatchDataNotFoundError(
        `js-initial-watch-data dom is not found. video url = ${url}`,
        videoId
      )
    );
  }
  const jsonString = apiDataDom.attributes.getNamedItem("data-api-data").value;
  const json: {
    thread: Thread;
  } = JSON.parse(jsonString);
  const thread = json.thread;
  return thread.ids.default;
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
