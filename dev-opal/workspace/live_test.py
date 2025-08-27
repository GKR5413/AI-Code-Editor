import datetime
import platform

print(f"Current Time: {datetime.datetime.now()}")
print(f"System: {platform.system()} {platform.release()}")
print(f"Node Name: {platform.node()}")
print(f"Machine: {platform.machine()}")
print(f"Processor: {platform.processor()}")
