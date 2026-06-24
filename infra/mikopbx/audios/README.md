# Audios para MikoPBX

Audios pre-generados que el `bootstrap.sh` copia al contenedor MikoPBX en cada
arranque del stack. Se versionan binarios pequeños para evitar dependencias
en runtime (no hace falta gTTS ni Internet al hacer `docker compose up`).

## Archivos

| Archivo | Uso |
|---|---|
| `ucgi-tts.mp3` | Anuncio institucional reproducido al llamante 1003 mientras espera que un agente conteste. El `bootstrap.sh` lo convierte a wav/sln/alaw/ulaw/gsm con `sox` dentro del contenedor para que Asterisk lo sirva en cualquier códec. |

## Regenerar el TTS

Si querés cambiar el texto:

```bash
pip3 install --user gtts
python3 gen-tts.py
```

Reemplaza `ucgi-tts.mp3`. Después `docker compose up -d --force-recreate mikopbx-bootstrap` para que el sidecar lo reaplique.

## Texto actual

> Bienvenido a UCGI. Su llamada es importante para nosotros. En un momento será atendido por uno de nuestros agentes. Por favor espere en línea.
