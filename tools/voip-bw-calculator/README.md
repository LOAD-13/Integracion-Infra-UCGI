# Calculadora de Capacidad VoIP — guía con todo explicado

Esta calculadora responde una pregunta concreta del laboratorio UCGI: **"con el ancho de banda que tengo disponible, ¿cuántas llamadas simultáneas puedo hacer al mismo tiempo sin que se escuchen mal?"**.

Es una ventana de escritorio (Tkinter) escrita en Python. No depende de Docker ni del resto del proyecto — se abre con un comando y permite jugar con los parámetros.

> **Audiencia:** este README está escrito asumiendo que el lector no ha trabajado antes con VoIP. Cada término técnico se explica al menos una vez.

---

## 1. Cómo correrla

```bash
cd tools/voip-bw-calculator
pip install -r requirements.txt
python calculator.py
```

En Windows, si el comando `python` no existe, usar `py` (por ejemplo `py -m pip install -r requirements.txt`). En Ubuntu, si falta Tkinter, instalarlo con `sudo apt install python3-tk`.

Al ejecutarla se abre una ventana de ~1100×780 px con dos sliders, una tabla, una gráfica y un pie con la fórmula.

---

## 2. La ventana, parte por parte

### 2.1 Botón "Medir BW de mi red"

Arriba a la derecha hay un botón que **mide automáticamente el ancho de banda real** de la red en la que estés conectado. Usa el servicio público **Speedtest.net** vía la librería `speedtest-cli`.

- Al hacer click cambia a "Midiendo..." y queda deshabilitado mientras corre (~10–30 segundos).
- Cuando termina, el slider de **Ancho de banda** se actualiza con el valor real de **descarga** (Mbps) medido.
- Si hay un error (sin internet, firewall bloqueando, etc.) muestra un mensaje y deja los sliders como estaban.

Para la presentación del jueves, esto permite decir: *"esta es la velocidad real de la red del salón… con eso podemos hacer X llamadas en G.711 o Y llamadas en G.729"*.

### 2.2 Slider "Ancho de banda disponible (Mbps)"

Es la **capacidad total** de la conexión a internet o de la red interna, expresada en **megabits por segundo** (Mbps).

> **¿Qué es un megabit?** Es **1 000 000 de bits**. Un bit es la unidad mínima de información (un 0 o un 1). No confundir con megaBYTE (MB): 1 byte = 8 bits, entonces 100 Mbps de internet equivale a unos 12.5 MB/s de descarga real.

Ejemplos típicos:

| Tipo de conexión | Ancho de banda típico |
|---|---|
| Internet doméstico básico | 20–50 Mbps |
| Internet doméstico fibra | 100–600 Mbps |
| Internet corporativo de oficina | 100–1000 Mbps |
| LAN ethernet cableada interna | 1000 Mbps (1 Gbps) o 10 Gbps |

El slider va de 1 a 1000 Mbps. El valor se muestra en azul brillante a la derecha.

### 2.3 Slider "Holgura por jitter (%)"

Este es el más importante de entender, y el más sutil. Vamos por partes.

**¿Qué es el jitter?**
Cuando los paquetes de audio viajan por la red, no llegan separados exactamente por la misma cantidad de tiempo. Unos llegan con 20 ms de diferencia (lo ideal), otros con 18 ms, otros con 25 ms. Esa **variación en el tiempo de llegada** se llama **jitter**.

**¿Por qué importa?**
El oído humano nota inmediatamente cuando el audio no llega de forma rítmica. Si el jitter es alto, se escucha entrecortado, robotizado, o se pierde sincronía. Para evitarlo, los teléfonos VoIP usan un **buffer de jitter** que acumula varios paquetes y los reproduce ordenados. Pero ese buffer tiene un límite.

**¿Y qué tiene que ver la holgura?**
Si **llenamos el 100% del ancho de banda con llamadas**, cualquier paquete extra (señalización SIP, RTCP de control, fragmentación de IP, retransmisión TCP de la base de datos en otro flujo) **causará pérdida o jitter** en las llamadas. Para evitarlo, **reservamos un margen** que no usamos para llamadas — eso es la **holgura**.

**¿Qué porcentaje uso?**
- **0%** = usar el 100% del ancho de banda para llamadas. Es el caso teórico, no debería usarse en producción.
- **30%** (recomendado) = reservar el 30% para otros usos y absorber jitter. Es el valor que recomiendan operadores de VoIP como BICOM, 3CX o Asterisk.
- **50%** = ultra-conservador, para redes inestables o Wi-Fi público.

El slider va de 0 a 50%.

### 2.4 Tabla "Llamadas soportadas por códec"

La fila central de la GUI. Tiene 6 columnas. Veámoslas una por una.

#### Columna 1 — Códec
El nombre del códec de audio. Un **códec** es el algoritmo que **comprime el sonido analógico** del micrófono a bits que viajen por la red, y al revés en el otro lado. En la calculadora aparecen los 5 que demuestra el lab UCGI:
- **G.711 ALAW** y **G.711 ULAW** — el estándar más antiguo, máxima calidad, sin compresión real.
- **GSM 06.10** — el de las redes móviles 2G.
- **G.729A** — el más eficiente, predilecto para llamadas internacionales.
- **Opus @ 24 kbps** — el moderno, obligatorio en WebRTC.

Cada uno tiene un trade-off entre **calidad subjetiva** (qué tan bien se escucha) y **ancho de banda consumido** (cuánto pesa la llamada en la red). La calculadora muestra esa relación visualmente.

#### Columna 2 — Bitrate
Es la cantidad de bits por segundo que produce el códec **solo del audio**, sin contar lo que el resto de la red añade.
- G.711 = **64 kbps** (cada llamada produce 64 000 bits por segundo de audio).
- GSM = **13 kbps**.
- G.729 = **8 kbps** (¡8 veces menos que G.711!).
- Opus a configuración media = **24 kbps**.

**Pero ojo: el bitrate NO es el ancho de banda real que la llamada consume en la red.** Sigue la columna 3.

#### Columna 3 — BW por llamada
**BW = bandwidth = ancho de banda.** Esta columna muestra cuánto consume **realmente** una llamada bidireccional (los dos sentidos: yo te escucho a vos, vos me escuchás a mí) **incluyendo los encabezados** que añaden los protocolos de red.

Cada paquete de audio que viaja por la red lleva **cabeceras de protocolo**:
- **RTP** (12 bytes) — el protocolo que transporta el audio.
- **UDP** (8 bytes) — el protocolo de transporte ligero (sin garantías de entrega).
- **IP** (20 bytes) — el direccionamiento de internet.
- **Ethernet** (18 bytes) — la capa más baja, el cable.

Total: **58 bytes de cabeceras por paquete**, y cada llamada manda **50 paquetes por segundo**. Esos 58 × 50 = 2900 bytes/seg ≈ 23 kbps SOLO de cabeceras, por sentido. Por eso una llamada G.711 que aparenta 64 kbps en realidad usa **174.4 kbps** en la red.

Para que veas el cambio:
| Códec | Bitrate audio | BW real con overhead (2 sentidos) | Multiplicador |
|---|---|---|---|
| G.711 | 64 kbps | 174.4 kbps | ×2.72 |
| GSM | 13 kbps | 72.8 kbps | ×5.60 |
| G.729 | 8 kbps | 62.4 kbps | ×7.80 |
| Opus@24 | 24 kbps | 94.4 kbps | ×3.93 |

Cuanto más comprimido es el códec, **más pesa proporcionalmente el overhead** (porque las cabeceras pesan lo mismo aunque el audio pese menos). Por eso saltar de G.711 a G.729 reduce el BW solo a la mitad, no a un octavo.

#### Columna 4 — Teóricas
El número máximo de llamadas simultáneas que **caben matemáticamente** en el ancho de banda configurado, **sin holgura**.

Fórmula: `Llamadas teóricas = BW total / BW por llamada`.

Por ejemplo, con 50 Mbps y G.711: 50000 kbps / 174.4 kbps por llamada = **286 llamadas**. Pero ese número **NO se debe usar en producción** porque dejaría cero margen para jitter, picos, otros tráficos y cabeceras adicionales.

#### Columna 5 — Realistas
Las que **sí podemos sostener en la práctica** sin que la calidad se degrade, descontando la holgura por jitter del slider.

Fórmula: `Llamadas realistas = BW total × (1 - holgura) / BW por llamada`.

Por ejemplo, con 50 Mbps, G.711 y 30% de holgura: 50000 × 0.7 / 174.4 = **200 llamadas**.

**Este es el número que se reporta al cliente** ("nuestro sistema soporta X llamadas concurrentes en su red").

#### Columna 6 — Notas
Una descripción corta de para qué se usa cada códec en la práctica:
- *PCM A-law. Europa, Latam, Asia. Sin compresión real.* → G.711 ALAW se usa fuera de EE.UU.
- *PCM μ-law. Norteamérica, Japón.* → ULAW se usa en EE.UU./Japón.
- *Full-Rate GSM. RPE-LTP. 5x menos BW que G.711.* → GSM es el clásico de móviles 2G.
- *CS-ACELP. 8x menos BW que G.711, MOS apenas inferior.* → G.729 es la mejor relación calidad/eficiencia.
- *Códec adaptativo obligatorio en WebRTC.* → Opus es el del navegador.

### 2.5 Gráfica "Llamadas realistas por códec"

Es una visualización en barras de la columna **Realistas**. Cada barra representa un códec y su altura es el número de llamadas que aguanta el sistema. Los colores son los mismos que en la tabla (verde, amarillo, naranja, azul).

Sirve para una mirada rápida: con un sólo vistazo el profesor o el cliente ve cuál es el códec que más exprime el ancho de banda.

### 2.6 Pie con la fórmula

La línea de texto al final muestra **literalmente la fórmula que aplica la calculadora**. No es decorativa: durante la defensa, podés señalarla y decir *"como ven en pantalla, BW por llamada = 2 × (payload + 58 bytes overhead) × 8 × 50 pps / 1000"* sin tener que recordarla de memoria.

---

## 3. Glosario completo (orden alfabético)

| Término | Definición |
|---------|------------|
| **Ancho de banda (BW)** | Capacidad de una red para transmitir datos. Se mide en bits por segundo (bps, kbps, Mbps, Gbps). |
| **Bit / Byte** | Bit = unidad mínima (0 o 1). Byte = 8 bits. 1 megabit ≠ 1 megabyte. |
| **Bitrate** | Bits por segundo que produce un códec, solo audio sin cabeceras de red. |
| **Buffer de jitter** | Memoria que acumula paquetes de audio para reproducirlos con ritmo constante. |
| **BW por llamada** | Total kbps que una llamada bidireccional consume en la red, incluyendo overhead. |
| **Cabecera (header)** | Bytes de metadata que cada protocolo añade al paquete. Necesarios para que la red sepa dónde mandar y cómo interpretar los datos. |
| **Códec** | Algoritmo que codifica (mic → bits) y decodifica (bits → speaker) audio. No es un protocolo. |
| **Frame** | Bloque mínimo de audio que el códec procesa de una vez. Para G.711 y GSM = 20 ms; para G.729 = 10 ms; Asterisk paquetiza en bloques de 20 ms para todos. |
| **G.711 ALAW** | Códec PCM estándar UIT-T, variante con curva A-law. 64 kbps. Europa, Latam, Asia. |
| **G.711 ULAW** | Códec PCM estándar UIT-T, variante con curva μ-law. 64 kbps. Norteamérica, Japón. |
| **G.729A** | Códec UIT-T basado en CS-ACELP. 8 kbps. Predilecto para troncales internacionales. |
| **GSM 06.10** | Códec móvil clásico, RPE-LTP. 13 kbps. |
| **Holgura por jitter** | Porcentaje del ancho de banda que NO se asigna a llamadas, reservado para absorber jitter y otros tráficos. |
| **IP** | Internet Protocol. Cabecera de 20 bytes (IPv4) que dirige el paquete a su destino. |
| **Jitter** | Variación en el tiempo entre paquetes que llegan. Medido en milisegundos. Alto jitter = audio entrecortado. |
| **kbps / Mbps / Gbps** | Kilobits / Megabits / Gigabits por segundo. 1 Mbps = 1000 kbps. 1 Gbps = 1000 Mbps. |
| **Llamadas realistas** | Número de llamadas que el sistema puede sostener sin degradar calidad, considerando holgura. |
| **Llamadas teóricas** | Número máximo de llamadas que caben en el ancho de banda sin reservar holgura. Cifra de papel, no operativa. |
| **MOS** | Mean Opinion Score. Escala 1–5 de calidad subjetiva del audio. G.711 ≈ 4.1, G.729 ≈ 3.9, GSM ≈ 3.7. |
| **Opus** | Códec adaptativo moderno (6–510 kbps). Obligatorio en WebRTC. RFC 6716. |
| **Overhead** | Bytes adicionales por paquete que no son audio: cabeceras de RTP+UDP+IP+Ethernet = 58 bytes total. |
| **Packet loss** | Porcentaje de paquetes que no llegan. Más de 1% degrada audio notablemente. |
| **Paquete** | Unidad de transmisión por la red. Cada llamada VoIP manda 50 paquetes por segundo (a 20 ms cada uno). |
| **Payload** | El audio comprimido, sin las cabeceras. Para G.711 = 160 bytes; G.729 = 20 bytes. |
| **PCM** | Pulse Code Modulation. Técnica de digitalización de audio. G.711 es PCM. |
| **PPS (paquetes/segundo)** | A 20 ms por paquete → 50 pps. Es constante para todos los códecs del lab. |
| **PSTN** | Public Switched Telephone Network. La red telefónica tradicional fija. |
| **RTP** | Real-time Transport Protocol. Cabecera de 12 bytes que transporta el audio. |
| **RTCP** | RTP Control Protocol. Va paralelo a RTP, lleva estadísticas (jitter, MOS). |
| **SIP** | Session Initiation Protocol. Lo que establece la llamada (no transporta audio). |
| **SIP Trunk** | Enlace lógico SIP a un proveedor externo (ITSP) o a otra PBX. |
| **UDP** | User Datagram Protocol. Cabecera de 8 bytes. Transporte sin garantías — perfecto para audio porque retransmitir paquetes perdidos sería peor que perderlos. |
| **VoIP** | Voice over IP. Telefonía sobre redes IP. |
| **WebRTC** | Web Real-Time Communication. API estándar de navegador para audio/video sin plugins. |

---

## 4. Casos de uso comunes para la defensa

| Escenario que defender | Ancho de banda | Holgura | Códec | Resultado |
|---|---|---|---|---|
| "Cliente PYME con 50 Mbps" | 50 | 30% | G.711 | 200 llamadas |
| "El mismo cliente migra a G.729 para internacional" | 50 | 30% | G.729 | 560 llamadas (×2.8 más) |
| "Oficina corporativa con 100 Mbps simétricos" | 100 | 30% | G.711 | 401 llamadas |
| "Data center con 1 Gbps" | 1000 | 20% | G.729 | 12 820 llamadas |
| "LAN interna ethernet" | 1000 | 0% | G.711 | 5 734 llamadas |

Para el día de la presentación: medir el BW del salón con el botón, jugar con los códecs delante del profesor, mostrar la fórmula al pie.

---

## 5. Tests

```bash
pytest tests/
```

Verifica que la fórmula produce valores canónicos. Por ejemplo: G.711 a 50 Mbps con 30% de holgura debe dar exactamente **200 llamadas**.

---

## 6. Estructura del paquete

```
voip-bw-calculator/
├── calculator.py        # Entry point + GUI Tkinter + matplotlib + botón speedtest
├── bw_calc.py           # Funciones puras (testeable)
├── codec_data.py        # Constantes por códec
├── tests/
│   └── test_bw_calc.py  # pytest
├── requirements.txt
└── README.md            # Este archivo
```

---

## 7. Limitaciones conocidas

- El cálculo asume **paquetización fija a 20 ms** para todos los códecs. En Asterisk se puede subir a 30 ms para G.729, pero la comparación pierde claridad.
- Solo cuenta tráfico de audio. RTCP y SIP suman ~5 kbps adicionales por llamada que aquí ignoramos.
- No incluye Wi-Fi como medio físico — el overhead 802.11 es mayor que el 802.3 que asumimos.
- El botón de medición usa **Speedtest.net**, que requiere internet y puede tardar 10–30 segundos.

Para una medición **real** del comportamiento del sistema bajo carga, usar el `ucgi-shaper` (HU-08.5) y los paneles Grafana (HU-08.2). Esta calculadora cubre la dimensión teórica; el shaper la empírica.

---

## 8. Referencias

- `docs/iso/calculo-capacidad-voip.md` — la fuente matemática de las constantes.
- **ITU-T G.711, G.729, GSM 06.10** — estándares oficiales de los códecs.
- **RFC 3550** (RTP), **RFC 768** (UDP), **RFC 791** (IPv4), **IEEE 802.3** (Ethernet).
- **RFC 6716** (Opus).
- **Google SRE Book**, capítulo 4 — SLIs y SLOs.
