import esp
import time
import network

from config import wifi_ssid, wifi_password

def do_connect():
    station = network.WLAN(network.STA_IF)
    if station.isconnected() != True:
        station.active(True)
        station.connect(wifi_ssid, wifi_password)
        while station.isconnected() == False:
            time.sleep(0.1)
    print("Connected")

do_connect()

#import ntptime
#ntptime.settime()

