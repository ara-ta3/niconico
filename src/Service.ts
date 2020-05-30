import { SeriesID, VideoID, Chat } from "./Contract";
import {
  fetchVideoIds,
  fetchThreadId,
  JSInitialWatchDataNotFoundError,
  fetchChats,
} from "./Gateway";

export async function fetchComments(
  seriesId: SeriesID
): Promise<Map<VideoID, Chat[]>> {
  const seriesUrl = `https://www.nicovideo.jp/series/${seriesId}`;
  const ids = await fetchVideoIds(seriesUrl);
  let comments: Map<string, Chat[]> = new Map();
  const all = ids.map(async (id) => {
    const threadId = await fetchThreadId(id).catch((err) => {
      // FIXME instanceof
      if (err.videoId !== undefined) {
        console.error(err);
        return Promise.resolve(null);
      }
      return Promise.reject(err);
    });
    if (threadId === null) {
      return;
    }
    const chats = await fetchChats(threadId);
    comments.set(id, chats);
    return;
  });
  await Promise.all(all);
  return comments;
}
