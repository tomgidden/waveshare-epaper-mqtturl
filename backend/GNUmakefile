TAG=waveshare-epaper-backend


all:

build: Dockerfile *.js
	docker build -t $(TAG) .

start:
	docker run -d --rm --init --cap-add=SYS_ADMIN -v ./events.json:/app/events.json -p 18000:18000 --name $(TAG) $(TAG)

stop:
	-docker kill $(TAG)

clean: stop
	-docker rmi $(TAG)

