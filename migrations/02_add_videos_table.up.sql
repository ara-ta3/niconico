CREATE TABLE IF NOT EXISTS videos (
    id varchar(255) not null,
    title varchar(255) not null,
    posted_at datetime not null,
    unique(id)
);
