import urequests
import epaper7in5
import framebuf
import random
import time

from config import mqtt_host, mqtt_port, mqtt_user, mqtt_password, mqtt_topic_url, mqtt_topic_status, mqtt_poll_interval

from machine import Pin, SPI
spi = SPI(2, baudrate=20000000, polarity=0, phase=0, sck=Pin(13), mosi=Pin(14), miso=Pin(12))
e = epaper7in5.EPD(spi, cs=Pin(15), dc=Pin(27), rst=Pin(26), busy=Pin(25))

w = 800
h = 480
x = 0
y = 0
widthBytes = w // 8

from umqtt.robust import MQTTClient

def cb(topic, message):
    e.init()
    url = message.decode('utf-8')
    response = urequests.get(url)
    buf = response.content
    response.close()
    e.display_frame(buf)
    e.sleep()

c = MQTTClient("epaper", mqtt_host, port=mqtt_port, user=mqtt_user, password=mqtt_password, keepalive=60)
c.set_callback(cb)
c.set_last_will(mqtt_topic_status, "offline")
c.connect(clean_session=False)
c.publish(mqtt_topic_status, "online")
c.subscribe(mqtt_topic_url)

while 1:
    c.ping()
    c.check_msg()
    time.sleep(mqtt_poll_interval)

c.disconnect()

