# syntax=docker/dockerfile:1.6
#
# Asterisk 20 LTS sobre debian:bullseye con módulos chan_pjsip,
# res_http_websocket, res_pjsip_transport_websocket y res_srtp.
#
# Multi-stage:
#   - builder : compila Asterisk con PJSIP bundled + libsrtp2.
#   - runtime : solo las libs y binarios necesarios para ejecutar.

ARG DEBIAN_TAG=bullseye-slim
ARG ASTERISK_VERSION=20.20.0

############################
# Stage 1 — Builder
############################
FROM debian:${DEBIAN_TAG} AS builder

ARG ASTERISK_VERSION
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates curl tar xz-utils \
        build-essential pkg-config \
        libssl-dev libncurses5-dev libxml2-dev libsqlite3-dev \
        uuid-dev libjansson-dev libedit-dev libsrtp2-dev \
        libcurl4-openssl-dev libspeex-dev libspeexdsp-dev \
        libogg-dev libvorbis-dev libsndfile1-dev \
        python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src
RUN curl -fL --retry 5 -o asterisk.tar.gz \
        "https://downloads.asterisk.org/pub/telephony/asterisk/releases/asterisk-${ASTERISK_VERSION}.tar.gz" \
    && tar -xzf asterisk.tar.gz \
    && rm asterisk.tar.gz

WORKDIR /usr/src/asterisk-${ASTERISK_VERSION}

# PJSIP viene bundled con el tarball de Asterisk. libsrtp2 desde apt.
# --without-pjproject-bundled NO se usa: queremos la versión validada por Digium.
RUN ./configure \
        --prefix=/usr \
        --sysconfdir=/etc \
        --localstatedir=/var \
        --with-pjproject-bundled \
        --with-jansson-bundled \
        --with-srtp \
        --without-asound

# Genera el árbol de opciones y selecciona módulos necesarios para WebRTC + SIP.
RUN make menuselect.makeopts \
    && menuselect/menuselect \
        --enable chan_pjsip \
        --enable res_pjsip \
        --enable res_pjsip_session \
        --enable res_pjsip_transport_websocket \
        --enable res_http_websocket \
        --enable res_srtp \
        --enable res_crypto \
        --enable codec_opus \
        --disable chan_sip \
        --disable BUILD_NATIVE \
        menuselect.makeopts

RUN make -j"$(nproc)" \
    && make install \
    && make samples

############################
# Stage 2 — Runtime
############################
FROM debian:${DEBIAN_TAG} AS runtime

ENV DEBIAN_FRONTEND=noninteractive

# Runtime libs (mismas familias que en builder, sin -dev).
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
        libssl1.1 libncurses5 libxml2 libsqlite3-0 \
        libjansson4 libedit2 libsrtp2-1 \
        libcurl4 libspeex1 libspeexdsp1 \
        libogg0 libvorbis0a libsndfile1 \
        libuuid1 \
        netcat-openbsd \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r asterisk \
    && useradd -r -g asterisk -d /var/lib/asterisk -s /usr/sbin/nologin asterisk

# Copiamos binarios, libs, módulos y dirs runtime desde el builder.
COPY --from=builder /usr/sbin/asterisk      /usr/sbin/asterisk
COPY --from=builder /usr/sbin/safe_asterisk /usr/sbin/safe_asterisk
COPY --from=builder /usr/lib/asterisk       /usr/lib/asterisk
COPY --from=builder /usr/lib/libasterisk*   /usr/lib/
COPY --from=builder /etc/asterisk           /etc/asterisk
COPY --from=builder /var/lib/asterisk       /var/lib/asterisk
COPY --from=builder /var/spool/asterisk     /var/spool/asterisk
COPY --from=builder /var/log/asterisk       /var/log/asterisk

RUN ldconfig \
    && mkdir -p /var/run/asterisk \
    && chown -R asterisk:asterisk \
        /etc/asterisk /var/lib/asterisk /var/log/asterisk \
        /var/spool/asterisk /var/run/asterisk

# Sobreescribe los samples con nuestras configs versionadas.
COPY --chown=asterisk:asterisk configs/ /etc/asterisk/

EXPOSE 5060/udp 8088/tcp 10000-10100/udp

# core show version retorna 0 si el daemon responde por el socket de control.
HEALTHCHECK --interval=20s --timeout=10s --start-period=45s --retries=3 \
    CMD asterisk -rx "core show version" >/dev/null 2>&1 || exit 1

USER asterisk
# -f foreground, -vvv verbose, -T sin colores, -U corre como user asterisk
CMD ["asterisk", "-f", "-vvv", "-T", "-U", "asterisk"]
