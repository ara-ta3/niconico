NPM=npm
NODE=node
DOCKER=docker
MYSQL_CONFIG=my.cnf
MYSQL=mysql --defaults-extra-file=$(MYSQL_CONFIG)

install:
	$(NPM) install

compile:
	$(NPM) run tsc

run: compile
	$(NODE) src/index.js --unhandled-rejections=strict

mysql/docker:
	$(DOCKER) run -e MYSQL_ROOT_PASSWORD=mysqlrootpassword -d -p 3306:3306 mysql:5.5

mysql:
	$(MYSQL) -uroot -pmysqlrootpassword -h 127.0.0.1

migrate/database:
	$(MYSQL) -e "CREATE DATABASE IF NOT EXISTS niconico"

migrate:
	cat migration.sql|$(MYSQL) niconico

$(MYSQL_CONFIG): my.sample.cnf
	cp -f $< $@
