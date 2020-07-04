export type SeriesID = string;

export type VideoID = string;

export type ThreadID = string;

export interface ThreadResponseBody {
  thread?: {};
  chat?: Chat;
}

export interface Chat {
  no: number;
  date: number;
  user_id: string;
  content: string;
}

export interface Video {
  id: VideoID;
  title: string;
  threadId: ThreadID;
  viewCount: number;
  postedAt: moment.Moment;
}
