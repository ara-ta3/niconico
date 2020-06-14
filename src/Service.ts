import { SeriesID, VideoID, Chat, Video } from "./Contract";
import { fetchVideoIds, fetchVideo, fetchChats, sleep } from "./Gateway";

export async function fetch(
  seriesId: SeriesID
): Promise<[Video[], Map<VideoID, Chat[]>]> {
  const seriesUrl = `https://www.nicovideo.jp/series/${seriesId}`;
  const ids = await fetchVideoIds(seriesUrl);
  let videos: Array<Video> = [];
  let comments: Map<string, Chat[]> = new Map();
  const all = ids.map(async (id) => {
    await sleep(1000);
    const video: Video | null = await fetchVideo(id).catch((err) => {
      // FIXME instanceof
      if (err.videoId !== undefined) {
        console.error(err);
        return Promise.resolve(null);
      }
      return Promise.reject(err);
    });
    if (video === null) {
      return;
    }
    const chats = await fetchChats(video.threadId);
    videos.push(video);
    comments.set(id, chats);
    return;
  });
  await Promise.all(all);
  return [videos, comments];
}
