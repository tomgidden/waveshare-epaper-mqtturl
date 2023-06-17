import urequests
import epaper7in5
import framebuf
import random
import time

from config import deepsleep_duration, mqtt_client, mqtt_host, mqtt_port, mqtt_user, mqtt_password, mqtt_topic_prefix

from machine import Pin, SPI, deepsleep
spi = SPI(2, baudrate=20000000, polarity=0, phase=0, sck=Pin(13), mosi=Pin(14), miso=Pin(12))
e = epaper7in5.EPD(spi, cs=Pin(15), dc=Pin(27), rst=Pin(26), busy=Pin(25))

w = 800
h = 480
x = 0
y = 0
widthBytes = w // 8

from umqtt.robust import MQTTClient

url = None
pause = False

def cb(topic, message):
    global url
    global pause
    global e

    topic = topic.decode('utf-8')
    if topic == f'{mqtt_topic_prefix}/pause':
        print ("Paused")
        pause = True
    elif topic == f'{mqtt_topic_prefix}/resume' or topic == f'{mqtt_topic_prefix}/unpause':
        print ("Resumed")
        pause = False
    elif topic == f'{mqtt_topic_prefix}/url':
        _url = message.decode('utf-8')
        if _url != url:
            print ("New URL received "+_url)
            url = _url
            pause = True
            e.init()
            response = urequests.get(url)
            buf = response.content
            response.close()
            e.display_frame(buf)
            e.sleep()
            pause = False

def mqtt_connect():
    mqtt = MQTTClient(mqtt_client, mqtt_host, port=mqtt_port, user=mqtt_user, password=mqtt_password, keepalive=60)
    mqtt.set_callback(cb)
    mqtt.set_last_will(f'{mqtt_topic_prefix}/status', "offline")
    mqtt.connect(clean_session=False)
    mqtt.publish(f'{mqtt_topic_prefix}/status', "online")
    return mqtt
    
while 1:
    c = 0
    mqtt = mqtt_connect()
    print ("MQTT connected")
    mqtt.subscribe(f'{mqtt_topic_prefix}/+')
    while c < 10:
        mqtt.publish(f'{mqtt_topic_prefix}/status', "waiting "+str(c))
        mqtt.check_msg()
        time.sleep(1)
        if not pause:
            c += 1
            print (c)
        else:
            c = 0

    mqtt.publish(f'{mqtt_topic_prefix}/status', "sleeping")
    print ("Sleeping")
    mqtt.disconnect()
    deepsleep(deepsleep_duration)


