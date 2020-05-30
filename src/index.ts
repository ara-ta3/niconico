import * as request from "request-promise-native";
import { JSDOM } from "jsdom";

async function main() {
  const seriesUrl = "https://www.nicovideo.jp/series/106485";

  const dom = await JSDOM.fromURL(seriesUrl);
  const document = dom.window.document;
  const ids = Array.from(
    document.getElementsByClassName("VideoMediaObject-title")
  ).map((div: any) =>
    div.children[0].attributes["href"].value.replace("/watch/", "")
  );
  console.log(ids);
}

main().catch((e) => console.error(e));
