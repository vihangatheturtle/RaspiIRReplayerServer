import broadlink
from broadlink.const import DEFAULT_PORT
from broadlink.exceptions import ReadError, StorageError
from flask import Flask, request
import time

app = Flask(__name__)

TICK = 32.84
TIMEOUT = 30
IR_TOKEN = 0x26
dev = None

@app.route('/replay-ir', methods = ['POST'])
def replayIR():
    global dev

    dev.auth()

    data = bytearray.fromhex(''.join(str(request.data.decode('utf-8'))))
    dev.send_data(data)
    return {
        "ok": True
    }

@app.route('/learn-ir')
def learnIR():
    global dev

    dev.auth()

    if dev == None:
        return {
            "error" : True,
        }
    else:
        dev.enter_learning()
        print("Learning...")
        start = time.time()
        while time.time() - start < TIMEOUT:
            time.sleep(1)
            try:
                data = dev.check_data()
            except (ReadError, StorageError):
                continue
            else:
                break
        else:
            return {
                "error": True
            }

        learned = ''.join(format(x, '02x') for x in bytearray(data))
        
        return {
            "data": learned
        }

@app.route('/discover')
def discoverDevices():
    global dev

    print("Discovering devices")
    devices = broadlink.discover(timeout=5)
    for device in devices:
        if device.auth():
            dev = broadlink.gendevice(device.devtype, (device.host[0], DEFAULT_PORT), ''.join(format(x, '02x') for x in device.mac))
            return {
                "type": hex(device.devtype),
                "host": device.host[0],
                "mac": ''.join(format(x, '02x') for x in device.mac)
            }
    return {
        "error": True
    }

if __name__ == '__main__':
    app.debug = True
    app.run(host='0.0.0.0', port=8000)