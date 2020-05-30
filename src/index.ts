import { promises as fs } from "fs";
import * as mysql from "promise-mysql";
import { fetch } from "./Service";
import { CommentRepository, VideoRepository } from "./Gateway";

async function settings(path: string = "./settings.json"): Promise<Settings> {
  const settingsString = await fs.readFile(path, "utf8");
  const settings: Settings = JSON.parse(settingsString);
  return settings;
}

async function main(args: string[]) {
  const seriesId = args[2];
  const setting = await settings();
  const connection = await mysql.createConnection({
    host: setting.mysql.host,
    user: setting.mysql.user,
    password: setting.mysql.password,
    database: "niconico",
  });

  const [videos, comments] = await fetch(seriesId);

  const commentRepository = new CommentRepository(connection);
  const videoRepository = new VideoRepository(connection);
  connection.beginTransaction();

  await commentRepository.put(comments);
  await videoRepository.put(videos);
  connection.commit();
  connection.end();
}

interface Settings {
  mysql: {
    host: string;
    user: string;
    password: string;
  };
}

main(process.argv).catch((e) => console.error(e));
