"""Genera ucgi-tts.mp3 con Google TTS en español (México).

Uso:
    pip3 install --user gtts
    python3 gen-tts.py

El MP3 resultante se commitea al repo y el bootstrap.sh lo convierte a
todos los formatos Asterisk (wav/sln/alaw/ulaw/gsm) dentro del contenedor.
"""

from pathlib import Path

from gtts import gTTS


TEXT = (
    "Bienvenido a UCGI. Su llamada es importante para nosotros. "
    "En un momento sera atendido por uno de nuestros agentes. "
    "Por favor espere en linea."
)


def main() -> None:
    out = Path(__file__).resolve().parent / "ucgi-tts.mp3"
    tts = gTTS(text=TEXT, lang="es", tld="com.mx", slow=False)
    tts.save(str(out))
    print(f"Saved {out}")


if __name__ == "__main__":
    main()
