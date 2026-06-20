import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  FilterPanel,
  type ClientFilters,
} from "@/components/clients/FilterPanel";

const baseFilters: ClientFilters = { assignedToMe: false };

describe("FilterPanel", () => {
  it("renderiza checkbox accesible para 'asignado a mí'", () => {
    render(
      <FilterPanel
        filters={baseFilters}
        onChange={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    const checkbox = screen.getByLabelText(/solo asignados a m/i);
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });

  it("dispara onChange con assignedToMe=true al marcar", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <FilterPanel
        filters={baseFilters}
        onChange={onChange}
        onClear={vi.fn()}
      />,
    );
    await user.click(screen.getByLabelText(/solo asignados a m/i));
    expect(onChange).toHaveBeenCalledWith({ assignedToMe: true });
  });

  it("muestra botón Limpiar solo cuando hay filtros activos", () => {
    const { rerender } = render(
      <FilterPanel
        filters={baseFilters}
        onChange={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /limpiar filtros/i }),
    ).not.toBeInTheDocument();

    rerender(
      <FilterPanel
        filters={{ assignedToMe: true }}
        onChange={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /limpiar filtros/i }),
    ).toBeInTheDocument();
  });

  it("documenta los filtros que llegan con HU-04.5", () => {
    render(
      <FilterPanel
        filters={baseFilters}
        onChange={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    expect(screen.getByText(/segmento/i)).toBeInTheDocument();
    expect(screen.getByText(/último contacto/i)).toBeInTheDocument();
  });
});
