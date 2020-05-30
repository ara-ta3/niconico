CREATE TABLE IF NOT EXISTS comments (
  no int unsigned not null,
  video_id varchar(255) not null,
  user_id varchar(255) not null,
  posted_at datetime not null
);
