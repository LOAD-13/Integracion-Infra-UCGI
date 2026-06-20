import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Softphone } from "@/components/softphone/Softphone";
import { SipContext, type SipContextValue } from "@/sip/sip-context";
import { INITIAL_STATE, type SipState } from "@/sip/sip-types";

function buildSipContext(initial: Partial<SipState> = {}): {
  ctx: SipContextValue;
  setState: (patch: Partial<SipState>) => void;
  stub: {
    call: ReturnType<typeof vi.fn>;
    answer: ReturnType<typeof vi.fn>;
    hangup: ReturnType<typeof vi.fn>;
    toggleMute: ReturnType<typeof vi.fn>;
    toggleHold: ReturnType<typeof vi.fn>;
  };
} {
  let state: SipState = { ...INITIAL_STATE, ...initial };
  let listener: ((next: SipState) => void) | null = null;
  const stub = {
    call: vi.fn(async () => {}),
    answer: vi.fn(async () => {}),
    hangup: vi.fn(async () => {}),
    toggleMute: vi.fn(() => {}),
    toggleHold: vi.fn(async () => {}),
  };
  const ctx: SipContextValue = {
    get state() {
      return state;
    },
    call: stub.call,
    answer: stub.answer,
    hangup: stub.hangup,
    toggleMute: stub.toggleMute,
    toggleHold: stub.toggleHold,
    toggleVideo: vi.fn(async () => {}),
    localStream: null,
    remoteStream: null,
  };
  // Define setter para forzar re-render desde el test
  function setState(patch: Partial<SipState>) {
    state = { ...state, ...patch };
    listener?.(state);
  }
  // Conserva el listener para el render functional
  (ctx as { _bindListener?: (l: (n: SipState) => void) => void })._bindListener =
    (l) => {
      listener = l;
    };
  return { ctx, setState, stub };
}

function ContextHarness({ ctx }: { ctx: SipContextValue }) {
  // Forzamos render adicional cuando el setState externo se llama,
  // suscribiéndonos a un dispatcher interno via useReducer.
  const [, force] = React.useReducer((x: number) => x + 1, 0);
  React.useEffect(() => {
    (ctx as { _bindListener?: (l: () => void) => void })._bindListener?.(
      () => force(),
    );
  }, [ctx, force]);
  return (
    <SipContext.Provider value={ctx}>
      <Softphone />
    </SipContext.Provider>
  );
}

import React from "react";

beforeEach(() => {
  vi.stubGlobal("console", {
    ...console,
    warn: vi.fn(),
    error: vi.fn(),
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Softphone", () => {
  it("muestra el badge inactivo y bloquea marcar hasta estar registrado", () => {
    const { ctx } = buildSipContext({ registration: "idle" });
    render(<ContextHarness ctx={ctx} />);
    expect(screen.getByTestId("registration-badge")).toHaveTextContent(
      /inactivo/i,
    );
    expect(
      screen.getByRole("button", { name: /llamar al destino/i }),
    ).toBeDisabled();
  });

  it("habilita marcar cuando el cliente reporta Registrado", async () => {
    const { ctx, stub } = buildSipContext({
      registration: "registered",
    });
    const user = userEvent.setup();
    render(<ContextHarness ctx={ctx} />);

    await user.type(screen.getByLabelText(/marcar/i), "1002");
    await user.click(
      screen.getByRole("button", { name: /llamar al destino/i }),
    );
    await waitFor(() => expect(stub.call).toHaveBeenCalledWith("1002"));
  });

  it("acepta números, asteriscos y prefijos de salida sin validar formato", async () => {
    const { ctx, stub } = buildSipContext({
      registration: "registered",
    });
    const user = userEvent.setup();
    render(<ContextHarness ctx={ctx} />);
    await user.type(screen.getByLabelText(/marcar/i), "9*001#");
    await user.click(
      screen.getByRole("button", { name: /llamar al destino/i }),
    );
    await waitFor(() => expect(stub.call).toHaveBeenCalledWith("9*001#"));
  });

  it("muestra acciones de contestar/rechazar para una llamada entrante", async () => {
    const { ctx, stub } = buildSipContext({
      registration: "registered",
      call: "incoming",
      remoteIdentity: "9001",
    });
    const user = userEvent.setup();
    render(<ContextHarness ctx={ctx} />);

    expect(screen.getByTestId("call-status")).toHaveTextContent(/entrante/i);
    expect(screen.getByTestId("remote-identity")).toHaveTextContent("9001");

    await user.click(
      screen.getByRole("button", { name: /contestar llamada/i }),
    );
    expect(stub.answer).toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: /rechazar llamada/i }),
    );
    expect(stub.hangup).toHaveBeenCalled();
  });

  it("ofrece mute y hold cuando hay llamada conectada", async () => {
    const { ctx, stub } = buildSipContext({
      registration: "registered",
      call: "connected",
      remoteIdentity: "1002",
    });
    const user = userEvent.setup();
    render(<ContextHarness ctx={ctx} />);

    await user.click(screen.getByRole("button", { name: /silenciar micr/i }));
    expect(stub.toggleMute).toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: /poner llamada en espera/i }),
    );
    expect(stub.toggleHold).toHaveBeenCalled();
  });

  it("renderiza el mensaje de error de registro accesible", () => {
    const { ctx } = buildSipContext({
      registration: "failed",
      errorMessage: "Sin extensión SIP asignada",
    });
    render(<ContextHarness ctx={ctx} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/sin extensión sip asignada/i);
    expect(screen.getByTestId("registration-badge")).toHaveTextContent(/error/i);
  });

  it("reacciona a actualizaciones de estado externas (listener)", () => {
    const { ctx, setState } = buildSipContext({ registration: "idle" });
    render(<ContextHarness ctx={ctx} />);
    expect(screen.getByTestId("registration-badge")).toHaveTextContent(
      /inactivo/i,
    );
    act(() => setState({ registration: "registered" }));
    expect(screen.getByTestId("registration-badge")).toHaveTextContent(
      /registrado/i,
    );
  });
});
