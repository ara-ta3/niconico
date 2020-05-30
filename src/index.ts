import { fetchComments } from "./Service";

async function main() {
  const seriesId = 106485;
  const comments = await fetchComments(seriesId);
  console.log(comments);
}

main().catch((e) => console.error(e));
