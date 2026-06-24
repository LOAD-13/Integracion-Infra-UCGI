import {
  Inviter,
  Invitation,
  Registerer,
  RegistererState,
  SessionState,
  UserAgent,
  UserAgentOptions,
  type Session,
} from "sip.js";
import {
  INITIAL_STATE,
  type SipConfig,
  type SipState,
} from "./sip-types";

type Listener = (state: SipState) => void;
type StreamListener = (stream: MediaStream | null) => void;

/**
 * Envoltorio de sip.js orientado al softphone del CRM.
 *
 * Centraliza la lifecycle del {@link UserAgent}, expone el estado en un único
 * objeto {@link SipState} y notifica cambios mediante un listener. Encapsula
 * los detalles internos de sip.js (sesiones, transports) para que React solo
 * vea un API plano: connect, call, answer, hangup, mute, hold, video.
 *
 * <p>Reglas de estado importantes:
 * <ul>
 *   <li>Cada llamada arranca SIEMPRE solo-audio. El video se prende explícitamente
 *       con {@link #toggleVideo}, NO se persiste entre llamadas.</li>
 *   <li>{@link #toggleVideo} hace re-INVITE para que el peer reciba/deje de recibir
 *       el track; el mute previo se reaplica después porque el nuevo audio sender
 *       trae enabled=true por defecto.</li>
 *   <li>Los listeners del RTCPeerConnection ({@code track}, {@code negotiationneeded})
 *       se suscriben con {@code addEventListener} para no pisar handlers internos
 *       de sip.js.</li>
 * </ul>
 */
export class SipClient {
  private readonly config: SipConfig;
  private userAgent: UserAgent | null = null;
  private registerer: Registerer | null = null;
  private session: Session | null = null;
  private listener: Listener | null = null;
  private localStreamListener: StreamListener | null = null;
  private remoteStreamListener: StreamListener | null = null;
  private hookedPc: RTCPeerConnection | null = null;
  private state: SipState = { ...INITIAL_STATE };

  constructor(config: SipConfig) {
    this.config = config;
  }

  onStateChange(listener: Listener): void {
    this.listener = listener;
    listener(this.state);
  }

  onLocalStream(listener: StreamListener): void {
    this.localStreamListener = listener;
  }

  onRemoteStream(listener: StreamListener): void {
    this.remoteStreamListener = listener;
  }

  async toggleVideo(): Promise<void> {
    // Sin sesión establecida no podemos hacer re-INVITE — ignoramos el toggle
    // para que la próxima llamada arranque limpia en solo-audio.
    if (!this.session || this.state.call !== "connected") {
      return;
    }
    const wantVideo = !this.state.videoEnabled;
    const wasMuted = this.state.muted;
    try {
      await this.session.invite({
        sessionDescriptionHandlerOptions: {
          constraints: { audio: true, video: wantVideo },
        } as unknown as Record<string, unknown>,
      });
      this.update({ videoEnabled: wantVideo, cameraAvailable: true });
      // El re-INVITE creó nuevos senders. Reaplica mute y refresca streams.
      this.exposeLocalStream();
      this.exposeRemoteStream();
      if (wasMuted) {
        this.setMuted(true);
      }
    } catch (err) {
      this.update({
        cameraAvailable: false,
        errorMessage: err instanceof Error ? err.message : "No se pudo cambiar el video",
      });
    }
  }

  async connect(): Promise<void> {
    if (this.userAgent) return;
    this.update({ registration: "connecting", errorMessage: null });

    const uri = UserAgent.makeURI(
      `sip:${this.config.credentials.extension}@${this.config.domain}`,
    );
    if (!uri) {
      this.update({
        registration: "failed",
        errorMessage: "URI SIP inválida",
      });
      throw new Error("URI SIP inválida");
    }

    const options: UserAgentOptions = {
      uri,
      authorizationUsername: this.config.credentials.extension,
      authorizationPassword: this.config.credentials.secret,
      displayName: this.config.credentials.displayName,
      transportOptions: { server: this.config.wsUrl },
      delegate: {
        onInvite: (invitation: Invitation) => this.attachIncoming(invitation),
      },
    };

    this.userAgent = new UserAgent(options);
    this.registerer = new Registerer(this.userAgent);
    this.registerer.stateChange.addListener((state) =>
      this.handleRegistrationChange(state),
    );

    await this.userAgent.start();
    await this.registerer.register();
  }

  async disconnect(): Promise<void> {
    if (this.session) {
      await this.safeEnd(this.session);
      this.session = null;
    }
    if (this.registerer) {
      try {
        await this.registerer.unregister();
      } catch {
        // ignore — al cerrar la app no nos interesa si el unregister falla
      }
      this.registerer = null;
    }
    if (this.userAgent) {
      await this.userAgent.stop();
      this.userAgent = null;
    }
    this.unhookPeerConnection();
    this.update({ ...INITIAL_STATE });
  }

  async call(target: string): Promise<void> {
    if (!this.userAgent) {
      throw new Error("SipClient no conectado");
    }
    const cleaned = target.trim();
    if (!cleaned) {
      throw new Error("Destino vacío");
    }
    const targetUri = UserAgent.makeURI(`sip:${cleaned}@${this.config.domain}`);
    if (!targetUri) {
      throw new Error(`No se pudo construir URI para ${cleaned}`);
    }
    const inviter = new Inviter(this.userAgent, targetUri);
    this.attachOutgoing(inviter, cleaned);
    // Cada llamada arranca solo-audio, sin importar el state previo.
    await inviter.invite({
      sessionDescriptionHandlerOptions: {
        constraints: { audio: true, video: false },
      } as unknown as Record<string, unknown>,
    });
  }

  async answer(): Promise<void> {
    if (!this.session || this.state.call !== "incoming") return;
    if ("accept" in this.session && typeof this.session.accept === "function") {
      // Contestamos solo-audio; el agente activa video con el botón si lo necesita.
      await (this.session as Invitation).accept({
        sessionDescriptionHandlerOptions: {
          constraints: { audio: true, video: false },
        } as unknown as Record<string, unknown>,
      });
    }
  }

  async hangup(): Promise<void> {
    if (!this.session) return;
    await this.safeEnd(this.session);
  }

  toggleMute(): void {
    const next = !this.state.muted;
    this.setMuted(next);
  }

  async toggleHold(): Promise<void> {
    if (!this.session) return;
    if (this.state.call === "connected") {
      await this.session.invite({
        sessionDescriptionHandlerOptions: {
          hold: true,
        } as unknown as Record<string, unknown>,
      });
      this.update({ call: "on-hold" });
    } else if (this.state.call === "on-hold") {
      await this.session.invite({
        sessionDescriptionHandlerOptions: {
          hold: false,
        } as unknown as Record<string, unknown>,
      });
      this.update({ call: "connected" });
    }
  }

  getState(): SipState {
    return this.state;
  }

  private attachIncoming(invitation: Invitation): void {
    this.session = invitation;
    const from = invitation.remoteIdentity.uri.user ?? "desconocido";
    this.update({ call: "incoming", remoteIdentity: from });
    invitation.stateChange.addListener((state) =>
      this.handleSessionStateChange(state),
    );
  }

  private attachOutgoing(inviter: Inviter, target: string): void {
    this.session = inviter;
    this.update({ call: "outgoing", remoteIdentity: target });
    inviter.stateChange.addListener((state) =>
      this.handleSessionStateChange(state),
    );
  }

  private handleRegistrationChange(state: RegistererState): void {
    switch (state) {
      case RegistererState.Registered:
        this.update({ registration: "registered", errorMessage: null });
        break;
      case RegistererState.Unregistered:
        this.update({ registration: "unregistered" });
        break;
      case RegistererState.Terminated:
        this.update({ registration: "failed" });
        break;
      default:
        break;
    }
  }

  private handleSessionStateChange(state: SessionState): void {
    switch (state) {
      case SessionState.Established:
        // Llamada nueva: arranca limpia (audio sin mute, video apagado).
        this.update({
          call: "connected",
          muted: false,
          videoEnabled: false,
          cameraAvailable: false,
        });
        this.hookPeerConnection();
        this.exposeRemoteStream();
        this.exposeLocalStream();
        break;
      case SessionState.Terminated:
        this.unhookPeerConnection();
        this.session = null;
        this.remoteStreamListener?.(null);
        this.localStreamListener?.(null);
        this.update({
          call: "idle",
          remoteIdentity: null,
          muted: false,
          videoEnabled: false,
          cameraAvailable: false,
        });
        break;
      default:
        break;
    }
  }

  private exposeRemoteStream(): void {
    const pc = this.peerConnection();
    if (!pc) return;
    const remote = new MediaStream();
    pc.getReceivers().forEach((receiver) => {
      if (receiver.track) remote.addTrack(receiver.track);
    });
    this.remoteStreamListener?.(remote);
  }

  private exposeLocalStream(): void {
    const pc = this.peerConnection();
    if (!pc) return;
    const local = new MediaStream();
    pc.getSenders().forEach((sender) => {
      if (sender.track) local.addTrack(sender.track);
    });
    this.localStreamListener?.(local);
  }

  /**
   * Suscribe a track/negotiationneeded para que un re-INVITE (cuando el peer
   * suma o quita video) re-emita los streams al React layer. Usamos
   * addEventListener (no asignación directa a {@code ontrack}) para no pisar
   * handlers internos de sip.js.
   */
  private hookPeerConnection(): void {
    const pc = this.peerConnection();
    if (!pc || pc === this.hookedPc) return;
    this.unhookPeerConnection();
    pc.addEventListener("track", this.onRtcTrack);
    pc.addEventListener("negotiationneeded", this.onRtcRenegotiate);
    this.hookedPc = pc;
  }

  private unhookPeerConnection(): void {
    if (!this.hookedPc) return;
    try {
      this.hookedPc.removeEventListener("track", this.onRtcTrack);
      this.hookedPc.removeEventListener("negotiationneeded", this.onRtcRenegotiate);
    } catch {
      // ignore — el peer connection ya puede estar cerrado
    }
    this.hookedPc = null;
  }

  private onRtcTrack = (): void => {
    this.exposeRemoteStream();
  };

  private onRtcRenegotiate = (): void => {
    this.exposeLocalStream();
  };

  private peerConnection(): RTCPeerConnection | undefined {
    const handler = this.session?.sessionDescriptionHandler as unknown as
      | { peerConnection?: RTCPeerConnection }
      | undefined;
    return handler?.peerConnection;
  }

  private setMuted(muted: boolean): void {
    const tracks = this.localAudioTracks();
    for (const track of tracks) track.enabled = !muted;
    this.update({ muted });
  }

  private localAudioTracks(): MediaStreamTrack[] {
    const pc = this.peerConnection();
    if (!pc) return [];
    return pc
      .getSenders()
      .map((sender) => sender.track)
      .filter((track): track is MediaStreamTrack =>
        track !== null && track.kind === "audio",
      );
  }

  private async safeEnd(session: Session): Promise<void> {
    try {
      switch (session.state) {
        case SessionState.Initial:
        case SessionState.Establishing:
          if ("cancel" in session && typeof session.cancel === "function") {
            await (session as Inviter).cancel();
          } else if (
            "reject" in session &&
            typeof session.reject === "function"
          ) {
            await (session as Invitation).reject();
          }
          break;
        case SessionState.Established:
          await session.bye();
          break;
        default:
          break;
      }
    } catch {
      // las llamadas pueden estar ya en estado terminal — log silencioso
    }
  }

  private update(patch: Partial<SipState>): void {
    this.state = { ...this.state, ...patch };
    this.listener?.(this.state);
  }
}
