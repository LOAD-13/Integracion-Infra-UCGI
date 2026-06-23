import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AuthContext } from "@/auth/auth-context";
import { MetricsPage } from "@/pages/MetricsPage";

const authValue = {
  session: { token: "fake-jwt", username: "agente1", role: "AGENTE" },
  loading: false,
  error: null,
  signIn: vi.fn(),
  signOut: vi.fn(),
  clearMustChangePassword: vi.fn(),
};

const sampleMetrics = {
  date: "2026-06-19",
  answeredCount: 12,
  missedCount: 3,
  busyCount: 1,
  failedCount: 0,
  totalCount: 16,
  averageDurationSeconds: 198,
  answerRate: 0.75,
  byHour: Array.from({ length: 24 }, (_, hour) => ({
    hour,
    total: hour === 9 ? 5 : 0,
    answered: hour === 9 ? 4 : 0,
  })),
};

function renderPage(autoRefreshMs = 0) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={authValue}>
        <MetricsPage autoRefreshMs={autoRefreshMs} />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => sampleMetrics,
    })),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("MetricsPage", () => {
  it("renderiza los 4 KPI cards con valores agregados", async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId("kpi-llamadas-atendidas")).toHaveTextContent(
        "12",
      ),
    );
    expect(screen.getByTestId("kpi-duraci-n-media")).toHaveTextContent(
      "03:18",
    );
    expect(screen.getByTestId("kpi-tasa-de-atenci-n")).toHaveTextContent("75%");
    expect(screen.getByTestId("kpi-llamadas-perdidas")).toHaveTextContent("4");
  });

  it("muestra el gráfico de líneas accesible", async () => {
    renderPage();
    const chart = await screen.findByTestId("metrics-chart");
    expect(chart).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/gráfico/i),
    );
  });

  it("el botón Refrescar dispara un fetch adicional", async () => {
    renderPage();
    await screen.findByTestId("kpi-llamadas-atendidas");
    expect(fetch).toHaveBeenCalledTimes(1);
    const user = userEvent.setup();
    await user.click(screen.getByTestId("refresh-metrics"));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  });
});
