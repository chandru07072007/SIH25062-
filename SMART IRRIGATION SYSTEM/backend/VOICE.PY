import torch
import whisper
import sounddevice as sd
import numpy as np
import torchaudio
import ollama
import os
import pyttsx3
from transformers import SpeechT5Processor, SpeechT5ForTextToSpeech, SpeechT5HifiGan

# =========================
# DEVICE SETUP
# =========================
device = "cuda" if torch.cuda.is_available() else "cpu"
print("Using device:", device)

# =========================
# LOAD WHISPER (ASR)
# =========================
whisper_model = whisper.load_model("base", device=device)

# =========================
# LOAD SPEECHT5 (TTS)
# =========================
processor = None
tts_model = None
vocoder = None
speaker_embeddings = None
tts_fallback_engine = None

try:
    processor = SpeechT5Processor.from_pretrained("microsoft/speecht5_tts")
    tts_model = SpeechT5ForTextToSpeech.from_pretrained(
        "microsoft/speecht5_tts"
    ).to(device)
    vocoder = SpeechT5HifiGan.from_pretrained(
        "microsoft/speecht5_hifigan"
    ).to(device)
    speaker_embeddings = torch.randn((1, 512)).to(device)
    print("SpeechT5 loaded successfully")
except Exception as e:
    print(f"SpeechT5 unavailable ({e}). Falling back to pyttsx3.")
    tts_fallback_engine = pyttsx3.init()

  # =========================
# MICROPHONE SETTINGS
# =========================
def get_input_device_index():
    forced_index = os.environ.get("MIC_DEVICE_INDEX")
    if forced_index is not None:
        return int(forced_index)

    devices = sd.query_devices()

    def score_device(name: str) -> int:
        n = name.lower()
        score = 0
        if "microphone" in n or "mic" in n:
            score += 5
        if "realtek" in n:
            score += 5
        if "mapper" in n or "primary" in n or "stereo mix" in n:
            score -= 6
        if "speaker" in n or "output" in n:
            score -= 4
        return score

    candidates = []
    for idx, dev in enumerate(devices):
        if dev.get("max_input_channels", 0) > 0:
            candidates.append((score_device(dev.get("name", "")), idx))

    if not candidates:
        raise RuntimeError("No input microphone device found.")

    candidates.sort(reverse=True)
    return int(candidates[0][1])


def print_input_devices():
    print("Available input devices:")
    for idx, dev in enumerate(sd.query_devices()):
        if dev.get("max_input_channels", 0) > 0:
            print(f"  [{idx}] {dev['name']} (channels={dev['max_input_channels']})")


print_input_devices()
MIC_DEVICE = get_input_device_index()
device_info = sd.query_devices(MIC_DEVICE, "input")
samplerate = int(device_info["default_samplerate"])
print(f"Using input device {MIC_DEVICE}: {device_info['name']}")

RECORD_SECONDS = 7
MIN_RMS = 0.003
TARGET_RMS = 0.08
MAX_GAIN = 30.0


def prepare_audio(audio: np.ndarray) -> np.ndarray:
    audio = audio.astype(np.float32)

    rms = float(np.sqrt(np.mean(np.square(audio)) + 1e-12))
    peak = float(np.max(np.abs(audio)) + 1e-12)
    print(f"Mic level -> RMS: {rms:.6f}, Peak: {peak:.6f}")

    if rms < MIN_RMS:
        print("Microphone input is too low. Speak louder or move closer to the mic.")
        return np.array([], dtype=np.float32)

    gain = min(TARGET_RMS / max(rms, 1e-6), MAX_GAIN)
    audio = audio * gain

    peak_after = float(np.max(np.abs(audio)) + 1e-12)
    if peak_after > 1.0:
        audio = audio / peak_after

    return np.clip(audio, -1.0, 1.0)

# =========================
# SPEECH TO TEXT
# =========================
def listen():
    print("\nSpeak now...")
    audio = sd.rec(
        int(RECORD_SECONDS * samplerate),
        samplerate=samplerate,
        channels=1,
        device=MIC_DEVICE
    )
    sd.wait()

    audio = audio.squeeze().astype(np.float32)

    # Resample to 16000 if needed
    if samplerate != 16000:
        audio_tensor = torch.tensor(audio)
        resampler = torchaudio.transforms.Resample(samplerate, 16000)
        audio_tensor = resampler(audio_tensor)
        audio = audio_tensor.numpy()

    audio = prepare_audio(audio)

    if audio.size == 0:
        return ""

    result = whisper_model.transcribe(audio, fp16=False, temperature=0)
    text = result["text"].strip()

    print("You said:", text)
    return text

# =========================
# AI RESPONSE
# =========================
def ask_ai(question):
    response = ollama.chat(
        model="tinyllama",
        messages=[
            {
                "role": "system",
                "content": "You are Jarvis. Answer briefly in 2-3 short sentences."
            },
            {
                "role": "user",
                "content": question
            }
        ]
    )

    return response["message"]["content"][:800]

# =========================
# TEXT TO SPEECH
# =========================
def speak(text):
    if tts_fallback_engine is not None:
        tts_fallback_engine.say(text)
        tts_fallback_engine.runAndWait()
        return

    chunks = []
    max_chars = 350

    while len(text) > max_chars:
        split_at = text.rfind(".", 0, max_chars)
        if split_at == -1:
            split_at = max_chars
        chunks.append(text[:split_at+1])
        text = text[split_at+1:]
    chunks.append(text)

    for chunk in chunks:
        inputs = processor(text=chunk.strip(), return_tensors="pt").to(device)

        speech = tts_model.generate_speech(
            inputs["input_ids"],
            speaker_embeddings,
            vocoder=vocoder
        )

        audio = speech.cpu().numpy()
        sd.play(audio, 16000)
        sd.wait()

# =========================
# MAIN LOOP
# =========================
print("\nNEURAL JARVIS READY (Say 'stop' to exit)")

while True:
    user_text = listen()

    if not user_text:
        continue

    if "stop" in user_text.lower():
        speak("Shutting down. Goodbye.")
        break

    answer = ask_ai(user_text)

    print("Jarvis:", answer)
    speak(answer)