import struct
import os

filename = "test_audio.raw"

if not os.path.exists(filename):
    print(f"{filename} not found.")
    exit(1)

with open(filename, "rb") as f:
    data = f.read()
    
print(f"Total bytes received: {len(data)}")

# Let's check the first 100 bytes directly
print("First 100 bytes (hex):")
print(data[:100].hex())

print("\nFirst 100 bytes (ascii, ignoring non-printable):")
ascii_repr = "".join(chr(b) if 32 <= b <= 126 else "." for b in data[:100])
print(ascii_repr)

# Common headers to look for
if data.startswith(b'RIFF'):
    print("\nDETECTED WAV HEADER (RIFF)")
elif data.startswith(b'ID3'):
    print("\nDETECTED MP3 HEADER (ID3)")
elif b'webm' in data[:100]:
    print("\nDETECTED WebM HEADER")
elif b'mp4' in data[:100]:
    print("\nDETECTED MP4/M4A HEADER")

