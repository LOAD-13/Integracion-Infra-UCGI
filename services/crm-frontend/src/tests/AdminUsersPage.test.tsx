import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthContext } from "@/auth/auth-context";
import { AdminUsersPage } from "@/pages/AdminUsersPage";
import { ProtectedRoute } from "@/routes/ProtectedRoute";

const adminSession = {
  session: { token: "fake-jwt", username: "admin", role: "ADMIN" },
  loading: false,
  error: null,
  signIn: vi.fn(),
  signOut: vi.fn(),
};
const agentSession = {
  ...adminSession,
  session: { token: "fake-jwt", username: "agente1", role: "AGENTE" },
};

const sampleUsers = [
  {
    id: 1,
    username: "admin",
    email: "admin@ucgi.local",
    fullName: "Administrador",
    role: "ADMIN",
    active: true,
    createdAt: "2026-06-19T10:00:00Z",
  },
  {
    id: 2,
    username: "agente1",
    email: "agente1@ucgi.local",
    fullName: "Agente Uno",
    role: "AGENTE",
    active: true,
    createdAt: "2026-06-19T10:00:00Z",
  },
];

function renderAdmin(authValue = adminSession) {
  return render(
    <MemoryRouter initialEntries={["/admin/users"]}>
      <AuthContext.Provider value={authValue}>
        <Routes>
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute roles={["ADMIN"]}>
                <AdminUsersPage />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<div>panel agente</div>} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/v1/users")) {
        return {
          ok: true,
          status: 200,
          json: async () => sampleUsers,
        } as Response;
      }
      return { ok: true, status: 204, json: async () => null } as Response;
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AdminUsersPage", () => {
  it("redirige a / si el rol no es ADMIN", async () => {
    renderAdmin(agentSession);
    await waitFor(() =>
      expect(screen.getByText("panel agente")).toBeInTheDocument(),
    );
  });

  it("renderiza la lista de usuarios para el rol ADMIN", async () => {
    renderAdmin();
    expect(await screen.findByText("admin")).toBeInTheDocument();
    expect(screen.getByText("agente1")).toBeInTheDocument();
    expect(screen.getByTestId("role-select-admin")).toHaveValue("ADMIN");
    expect(screen.getByTestId("role-select-agente1")).toHaveValue("AGENTE");
  });

  it("cambia el rol con el selector y dispara PUT", async () => {
    renderAdmin();
    await screen.findByText("agente1");
    const user = userEvent.setup();
    await user.selectOptions(
      screen.getByTestId("role-select-agente1"),
      "ADMIN",
    );
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/users/2/role"),
        expect.objectContaining({ method: "PUT" }),
      ),
    );
  });
});
