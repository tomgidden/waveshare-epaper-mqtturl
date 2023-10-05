TAG=tomgidden/waveshare-epaper-backend

all:

build: Dockerfile *.js
	docker build -t $(TAG) .

start:
	docker run -d --rm --init --cap-add=SYS_ADMIN -v ./events.json:/app/events.json -p 18000:18000 --name $(TAG) $(TAG)

stop:
	-docker kill $(TAG)

clean: stop
	-docker rmi $(TAG)

log:
logs:
tail:
	docker logs -f $(TAG)

test:
	mosquitto_pub -h 192.168.0.2 -t epaper1/url -m http://hass.home:18000/epaper1-`date +"%s%N"`.raw -r
	mosquitto_pub -h 192.168.0.2 -t epaper2/url -m http://hass.home:18000/epaper2-`date +"%s%N"`.raw -r


