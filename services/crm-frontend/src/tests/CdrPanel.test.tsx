import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CdrPanel } from "@/components/cdr/CdrPanel";
import { SipContext, type SipContextValue } from "@/sip/sip-context";
import { INITIAL_STATE, type SipState } from "@/sip/sip-types";
import { AuthContext } from "@/auth/auth-context";

function sipCtx(initial: Partial<SipState> = {}): {
  ctx: SipContextValue;
  stub: { call: ReturnType<typeof vi.fn> };
} {
  const state: SipState = { ...INITIAL_STATE, ...initial };
  const stub = { call: vi.fn(async () => {}) };
  return {
    ctx: {
      state,
      call: stub.call,
      answer: vi.fn(),
      hangup: vi.fn(),
      toggleMute: vi.fn(),
      toggleHold: vi.fn(),
    },
    stub,
  };
}

const authValue = {
  session: { token: "fake-jwt", username: "agente1", role: "AGENTE" },
  loading: false,
  error: null,
  signIn: vi.fn(),
  signOut: vi.fn(),
};

const sampleCdrPage = {
  content: [
    {
      id: 1,
      callId: "abc",
      agentUserId: 1,
      clientId: 7,
      callerNumber: "+51999111003",
      calleeNumber: "1001",
      direction: "INBOUND",
      startTime: "2026-06-19T15:30:00",
      answerTime: "2026-06-19T15:30:05",
      endTime: "2026-06-19T15:35:00",
      durationSeconds: 300,
      disposition: "ANSWERED",
    },
    {
      id: 2,
      callId: "def",
      agentUserId: 1,
      clientId: 7,
      callerNumber: "1001",
      calleeNumber: "+51999111003",
      direction: "OUTBOUND",
      startTime: "2026-06-18T11:10:00",
      answerTime: null,
      endTime: "2026-06-18T11:10:30",
      durationSeconds: 30,
      disposition: "NO_ANSWER",
    },
  ],
  number: 0,
  size: 10,
  totalElements: 2,
  totalPages: 1,
  first: true,
  last: true,
};

function renderPanel(ctx: SipContextValue) {
  return render(
    <AuthContext.Provider value={authValue}>
      <SipContext.Provider value={ctx}>
        <CdrPanel clientId={7} fallbackNumber="+51999111003" />
      </SipContext.Provider>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => sampleCdrPage,
    })),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("CdrPanel", () => {
  it("renderiza el listado de CDR del cliente", async () => {
    const { ctx } = sipCtx({ registration: "registered" });
    renderPanel(ctx);
    expect(
      await screen.findByText(/2 llamadas · página 1 de 1/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/entrante/i)).toBeInTheDocument();
    expect(screen.getByText(/saliente/i)).toBeInTheDocument();
    expect(screen.getByText(/contestada/i)).toBeInTheDocument();
    expect(screen.getByText(/sin respuesta/i)).toBeInTheDocument();
  });

  it("click-to-call dispara useSip.call con el número del cliente", async () => {
    const { ctx, stub } = sipCtx({ registration: "registered" });
    const user = userEvent.setup();
    renderPanel(ctx);
    const button = await screen.findByRole("button", {
      name: /llamar a \+51999111003/i,
    });
    await user.click(button);
    expect(stub.call).toHaveBeenCalledWith("+51999111003");
  });

  it("click-to-call de un CDR entrante usa el callerNumber del registro", async () => {
    const { ctx, stub } = sipCtx({ registration: "registered" });
    const user = userEvent.setup();
    renderPanel(ctx);
    await screen.findByText(/contestada/i);
    const buttons = screen.getAllByRole("button", { name: /volver a llamar/i });
    await user.click(buttons[0]);
    await waitFor(() =>
      expect(stub.call).toHaveBeenCalledWith("+51999111003"),
    );
  });

  it("deshabilita los botones cuando el SIP no está registrado", async () => {
    const { ctx } = sipCtx({ registration: "idle" });
    renderPanel(ctx);
    await screen.findByText(/contestada/i);
    expect(
      screen.getByRole("button", { name: /llamar a \+51999111003/i }),
    ).toBeDisabled();
    screen
      .getAllByRole("button", { name: /volver a llamar/i })
      .forEach((b) => expect(b).toBeDisabled());
  });
});
