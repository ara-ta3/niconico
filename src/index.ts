import { promises as fs } from "fs";
import * as mysql from "promise-mysql";
import { fetchComments } from "./Service";
import { CommentRepository } from "./Gateway";

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

  const comments = await fetchComments(seriesId);

  const repository = new CommentRepository(connection);
  connection.beginTransaction();
  await repository.deleteAll();
  await repository.put(comments);
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
