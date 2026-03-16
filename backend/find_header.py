import os

filename = "test_audio.raw"

with open(filename, "rb") as f:
    data = f.read()

# Try to find common headers anywhere
if b'ftyp' in data[:1000]:
    idx = data.index(b'ftyp')
    print(f"Found ftyp (MP4/M4A) at {idx}")
if b'AMR' in data[:1000]:
    idx = data.index(b'AMR')
    print(f"Found AMR at {idx}")

# Print first 256 bytes to see what React Native sent
print("First 256 bytes (hex):")
print(data[:256].hex())
