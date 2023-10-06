TAG=tomgidden/waveshare-epaper-backend

all:

build: Dockerfile *.js
	docker build -t $(TAG) .

start:
	docker compose up -d

stop:
	-docker compose down

log:
	docker compose logs


