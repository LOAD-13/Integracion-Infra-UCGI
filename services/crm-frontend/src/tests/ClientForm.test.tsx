import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClientForm } from "@/components/clients/ClientForm";
import { emptyClient, type ClientFormValues } from "@/clients/client-schema";

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("ClientForm", () => {
  it("renderiza todos los campos accesibles y desactiva submit mientras se envía", async () => {
    const onSubmit = vi.fn(async () => {});
    render(
      <ClientForm
        defaultValues={emptyClient}
        submitLabel="Crear cliente"
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByLabelText(/nombre/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/teléfono/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/empresa/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/resumen de notas/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /crear cliente/i })).toBeEnabled();
  });

  it("muestra errores accesibles cuando falla la validación Zod", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <ClientForm
        defaultValues={emptyClient}
        submitLabel="Crear cliente"
        onSubmit={onSubmit}
      />,
    );
    await user.click(screen.getByRole("button", { name: /crear cliente/i }));
    expect(await screen.findByTestId("error-name")).toHaveTextContent(
      /obligatorio/i,
    );
    expect(screen.getByTestId("error-phone")).toHaveTextContent(/obligatorio/i);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rechaza email con formato inválido", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <ClientForm
        defaultValues={emptyClient}
        submitLabel="Crear cliente"
        onSubmit={onSubmit}
      />,
    );
    await user.type(screen.getByLabelText(/nombre/i), "Ana Vargas");
    await user.type(screen.getByLabelText(/teléfono/i), "+51999111001");
    await user.type(screen.getByLabelText(/email/i), "no-es-email");
    await user.click(screen.getByRole("button", { name: /crear cliente/i }));
    expect(await screen.findByTestId("error-email")).toHaveTextContent(
      /formato/i,
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("dispara onSubmit con los valores limpios cuando la validación pasa", async () => {
    const onSubmit = vi.fn<(values: ClientFormValues) => Promise<void>>(
      async () => {},
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <ClientForm
        defaultValues={emptyClient}
        submitLabel="Crear cliente"
        onSubmit={onSubmit}
      />,
    );
    await user.type(screen.getByLabelText(/nombre/i), "  Ana Vargas  ");
    await user.type(screen.getByLabelText(/teléfono/i), "+51999111001");
    await user.type(screen.getByLabelText(/email/i), "ana@example.com");
    await user.type(screen.getByLabelText(/empresa/i), "Importadora");
    await user.click(screen.getByRole("button", { name: /crear cliente/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0]?.[0];
    expect(payload?.name).toBe("Ana Vargas");
    expect(payload?.phone).toBe("+51999111001");
    expect(payload?.email).toBe("ana@example.com");
    expect(payload?.company).toBe("Importadora");
  });

  it("muestra el banner de error externo (errorMessage prop)", () => {
    render(
      <ClientForm
        defaultValues={emptyClient}
        submitLabel="Crear cliente"
        onSubmit={vi.fn()}
        errorMessage="Backend dijo que no"
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/backend dijo que no/i);
  });
});
