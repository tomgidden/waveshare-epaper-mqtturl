TAG=waveshare-epaper-backend


all:

build: Dockerfile *.js
	docker build -t $(TAG) .

run:
	docker run -d --rm --init --cap-add=SYS_ADMIN -p 18000:18000 $(TAG)

clean:
	docker rmi $(TAG)

