import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export interface ClientFilters {
  assignedToMe: boolean;
}

interface FilterPanelProps {
  filters: ClientFilters;
  onChange: (next: ClientFilters) => void;
  onClear: () => void;
}

export function FilterPanel({ filters, onChange, onClear }: FilterPanelProps) {
  const anyActive = filters.assignedToMe;
  return (
    <Card className="lg:sticky lg:top-6">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter aria-hidden="true" className="h-4 w-4" />
            Filtros
          </CardTitle>
          {anyActive && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onClear}
              aria-label="Limpiar filtros"
            >
              <X aria-hidden="true" className="mr-1 h-4 w-4" />
              Limpiar
            </Button>
          )}
        </div>
        <CardDescription>
          Combinable con la búsqueda libre. Los filtros se reflejan en la URL.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="text-xs uppercase tracking-wide text-muted-foreground">
            Asignación
          </legend>
          <label
            htmlFor="assignedToMe"
            className="flex items-center gap-2 text-sm"
          >
            <input
              id="assignedToMe"
              type="checkbox"
              className="h-4 w-4 rounded border-input accent-primary"
              checked={filters.assignedToMe}
              onChange={(e) =>
                onChange({ ...filters, assignedToMe: e.target.checked })
              }
              data-testid="filter-assignedToMe"
            />
            Solo asignados a mí
          </label>
        </fieldset>

        <fieldset className="space-y-2 opacity-60">
          <legend className="text-xs uppercase tracking-wide text-muted-foreground">
            Próximamente
          </legend>
          <p className="text-xs text-muted-foreground">
            <strong>Segmento</strong> y <strong>último contacto</strong>
            {" "}llegan con HU-04.5 cuando se conecte el histórico de CDR.
          </p>
        </fieldset>
      </CardContent>
    </Card>
  );
}
