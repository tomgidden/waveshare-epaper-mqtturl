"""
MicroPython Waveshare 7.5" Black/White GDEW075T8 e-paper display driver
https://github.com/mcauser/micropython-waveshare-epaper

MIT License
Copyright (c) 2017 Waveshare
Copyright (c) 2018 Mike Causer

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
"""

from micropython import const
from time import sleep_ms
import ustruct

# Display resolution
EPD_WIDTH  = const(800)
EPD_HEIGHT = const(480)

# Display commands
PANEL_SETTING                  = const(0x00)
POWER_SETTING                  = const(0x01)
POWER_OFF                      = const(0x02)
#POWER_OFF_SEQUENCE_SETTING     = const(0x03)
POWER_ON                       = const(0x04)
#POWER_ON_MEASURE               = const(0x05)
BOOSTER_SOFT_START             = const(0x06)
DEEP_SLEEP                     = const(0x07)
DATA_START_TRANSMISSION_1      = const(0x10)
#DATA_STOP                      = const(0x11)
DISPLAY_REFRESH                = const(0x12)
IMAGE_PROCESS                  = const(0x13)

#LUT_FOR_VCOM                   = const(0x20)
#LUT_BLUE                       = const(0x21)
#LUT_WHITE                      = const(0x22)
#LUT_GRAY_1                     = const(0x23)
#LUT_GRAY_2                     = const(0x24)
#LUT_RED_0                      = const(0x25)
#LUT_RED_1                      = const(0x26)
#LUT_RED_2                      = const(0x27)
#LUT_RED_3                      = const(0x28)
#LUT_XON                        = const(0x29)
PLL_CONTROL                    = const(0x30)
#TEMPERATURE_SENSOR_COMMAND     = const(0x40)
TEMPERATURE_CALIBRATION        = const(0x41)
#TEMPERATURE_SENSOR_WRITE       = const(0x42)
#TEMPERATURE_SENSOR_READ        = const(0x43)
VCOM_AND_DATA_INTERVAL_SETTING = const(0x50)
#LOW_POWER_DETECTION            = const(0x51)
TCON_SETTING                   = const(0x60)
TCON_RESOLUTION                = const(0x61)
#SPI_FLASH_CONTROL              = const(0x65)
#REVISION                       = const(0x70)
#GET_STATUS                     = const(0x71)
#AUTO_MEASUREMENT_VCOM          = const(0x80)
#READ_VCOM_VALUE                = const(0x81)
VCM_DC_SETTING                 = const(0x82)
FLASH_MODE                     = const(0xE5)

BUSY = const(0)  # 0=busy, 1=idle

class EPD:
    def __init__(self, spi, cs, dc, rst, busy):
        self.spi = spi
        self.cs = cs
        self.dc = dc
        self.rst = rst
        self.busy = busy
        self.cs.init(self.cs.OUT, value=1)
        self.dc.init(self.dc.OUT, value=0)
        self.rst.init(self.rst.OUT, value=0)
        self.busy.init(self.busy.IN)
        self.width = EPD_WIDTH
        self.height = EPD_HEIGHT

    def _command(self, command, data=None):
        self.dc(0)
        self.cs(0)
        self.spi.write(bytearray([command]))
        self.cs(1)
        if data is not None:
            self._data(data)

    def _beginTransaction(self):
        self.cs(0)

    def _transactionCommand(self, command):
        self.dc(0)
        self.spi.write(bytearray([command]))
        
    def _transactionData(self, data):
        self.dc(1)
        self.spi.write(data)

    def _endTransaction(self):
        self.cs(1)

    def _data(self, data):
        self.dc(1)
        self.cs(0)
        self.spi.write(data)
        self.cs(1)

    def init(self):
        self.reset()

#https://github.com/waveshareteam/e-Paper/blob/702def06bcb75983c98b0f9d25d43c552c248eb0/RaspberryPi%26JetsonNano/python/lib/waveshare_epd/epd7in5_V2.py

        self._command(0x06, b'\x17\x17\x28\x18') # BOOSTER_SOFT_START
        # If an exception is displayed, try using 0x38 instead of 0x28

        self._command(0x01, b'\x07\x07\x3f\x3f') # POWER_SETTING
        self._command(0x04) # POWER_ON
        sleep_ms(100)
        self.wait_until_idle()

        self._command(0x00, b'\x1f') # PANEL_SETTING:  full update LUT from OTP
        self._command(0x61, b'\x03\x20\x01\xe0') # TCON_RESOLUTION
#       self._command(0x61, ustruct.pack(">HH", EPD_WIDTH, EPD_HEIGHT)) # TCON_RESOLUTION
        self._command(0x15, b'\x00')
        self._command(0x50, b'\x29\x07') # VCOM_AND_DATA_INTERVAL_SETTING
        self._command(0x60, b'\x22') # TCON_SETTING
        sleep_ms(100)
        self.wait_until_idle()


    def wait_until_idle(self):
        self._command(0x71)
        while self.busy.value() == BUSY:
            self._command(0x71)
            sleep_ms(100)

    def reset(self):
        self.rst(1)
        sleep_ms(200)
        self.rst(0)
        sleep_ms(2)
        self.rst(1)
        sleep_ms(200)

    def clear(self):
        buf = bytearray( [0xaa] * (self.width // 8) )

        self._beginTransaction()
        self._transactionCommand(0x10) # DATA_START_TRANSMISSION_1
        for i in range(0, self.height):
            self._transactionData(buf)
        self._endTransaction()

        self._beginTransaction()
        self._transactionCommand(0x13) # IMAGE_PROCESS
        for i in range(0, self.height):
            self._transactionData(buf)
        self._endTransaction()

        self._command(0x12) # DISPLAY_REFRESH
        sleep_ms(100)
        self.wait_until_idle()  
 
    # draw the current frame memory
    def display_frame(self, buf):

        self._beginTransaction()
        self._transactionCommand(0x13) # IMAGE_PROCESS
        self._transactionData(buf)
        self._endTransaction()

#        self._command(0x10) # DATA_START_TRANSMISSION_1
#        for i in range(0, self.height):
#            self._data(bytearray(self.width // 8))

        self._command(0x12) # DISPLAY_REFRESH
        sleep_ms(100)
        self.wait_until_idle()

#        self._command(0x13) # IMAGE_PROCESS
#        self._data(buf)

#        self._command(0x10) # DATA_START_TRANSMISSION_1
#        for i in range(0, self.height):
#            self._data(bytearray(self.width // 8))

    # to wake call reset() or init()
    def sleep(self):
        self._command(0x02) # POWER_OFF
        self.wait_until_idle()
        self._command(0x07, b'\xA5') # DEEP_SLEEP
