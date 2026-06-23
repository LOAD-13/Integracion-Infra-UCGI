import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/auth/AuthProvider";
import { LoginPage } from "@/pages/LoginPage";

function renderApp() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<div>panel agente</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  // AuthProvider ahora persiste en localStorage; limpiamos entre tests para
  // que cada uno arranque sin sesión.
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("LoginPage", () => {
  it("renderiza form accesible con labels asociados", () => {
    renderApp();
    expect(
      screen.getByRole("heading", { name: /dialflow.*crm/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/usuario/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /ingresar/i }),
    ).toBeInTheDocument();
  });

  it("happy path: con credenciales válidas redirige al panel", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        accessToken: "fake.jwt.token",
        tokenType: "Bearer",
        expiresIn: 3600,
        username: "agente1",
        role: "AGENT",
      }),
    } satisfies Partial<Response>);

    const user = userEvent.setup();
    renderApp();

    await user.type(screen.getByLabelText(/usuario/i), "agente1");
    await user.type(screen.getByLabelText(/contraseña/i), "Secret123");
    await user.click(screen.getByRole("button", { name: /ingresar/i }));

    await waitFor(() =>
      expect(screen.getByText("panel agente")).toBeInTheDocument(),
    );
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/v1/auth/login"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ username: "agente1", password: "Secret123" }),
      }),
    );
  });

  it("muestra mensaje accesible cuando el backend responde 401", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({ message: "Bad credentials" }),
    } satisfies Partial<Response>);

    const user = userEvent.setup();
    renderApp();

    await user.type(screen.getByLabelText(/usuario/i), "agente1");
    await user.type(screen.getByLabelText(/contraseña/i), "wrong");
    await user.click(screen.getByRole("button", { name: /ingresar/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/usuario o contraseña incorrectos/i);
    expect(screen.queryByText("panel agente")).not.toBeInTheDocument();
  });
});
