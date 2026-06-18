"""Calculadora interactiva de capacidad VoIP.

Tkinter GUI que muestra, según el ancho de banda y la holgura configurados,
cuántas llamadas simultáneas soporta el sistema con cada códec.

Uso:
    python calculator.py

Diseñada para la defensa pedagógica del lab UCGI (Calidad de Software).
Sin dependencias de Docker — corre standalone.
"""

import threading
import tkinter as tk
from tkinter import messagebox, ttk

from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
from matplotlib.figure import Figure

from bw_calc import calls_table
from codec_data import (
    CODECS,
    PACKETS_PER_SECOND,
    PACKET_INTERVAL_MS,
    RTP_UDP_IP_ETH_OVERHEAD_BYTES,
)


BG = "#1a2638"
FG = "#ecf0f1"
ACCENT = "#3498db"
SUCCESS = "#2ecc71"
WARNING = "#e67e22"


class CalculatorApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("UCGI · Calculadora de Capacidad VoIP")
        self.root.geometry("1100x780")
        self.root.configure(bg=BG)

        self.bw_var = tk.IntVar(value=50)
        self.headroom_var = tk.IntVar(value=30)

        self._build_styles()
        self._build_header()
        self._build_controls()
        self._build_table()
        self._build_chart()
        self._build_formula_footer()

        self.refresh()

    # ---------------------------------------------------------------- styles
    def _build_styles(self):
        style = ttk.Style()
        style.theme_use("clam")
        style.configure("Treeview",
                        background="#2c3e50",
                        foreground=FG,
                        fieldbackground="#2c3e50",
                        rowheight=28,
                        borderwidth=0,
                        font=("Segoe UI", 10))
        style.configure("Treeview.Heading",
                        background="#34495e",
                        foreground=FG,
                        font=("Segoe UI", 10, "bold"))
        style.map("Treeview", background=[("selected", ACCENT)])
        style.configure("Horizontal.TScale", background=BG, troughcolor="#34495e")

    # ---------------------------------------------------------------- header
    def _build_header(self):
        header = tk.Frame(self.root, bg=BG)
        header.pack(fill="x", padx=20, pady=(20, 10))

        title_frame = tk.Frame(header, bg=BG)
        title_frame.pack(side="left", fill="x", expand=True)
        tk.Label(title_frame,
                 text="UCGI · Calculadora de Capacidad VoIP",
                 font=("Segoe UI", 18, "bold"),
                 bg=BG, fg=FG).pack(anchor="w")
        tk.Label(title_frame,
                 text="Calidad de Software · Laboratorio de Integración · S15",
                 font=("Segoe UI", 10),
                 bg=BG, fg="#95a5a6").pack(anchor="w")

        measure_frame = tk.Frame(header, bg=BG)
        measure_frame.pack(side="right", padx=(10, 0))
        self.measure_btn = tk.Button(
            measure_frame,
            text="📡  Medir BW de mi red",
            font=("Segoe UI", 10, "bold"),
            bg=ACCENT, fg=FG, activebackground="#2980b9",
            relief="flat", padx=14, pady=8,
            cursor="hand2",
            command=self.measure_bandwidth,
        )
        self.measure_btn.pack(side="top")
        self.measure_status = tk.Label(
            measure_frame, text="", font=("Segoe UI", 9),
            bg=BG, fg="#95a5a6",
        )
        self.measure_status.pack(side="top", pady=(4, 0))

    # -------------------------------------------------------------- controls
    def _build_controls(self):
        controls = tk.Frame(self.root, bg=BG)
        controls.pack(fill="x", padx=20, pady=10)

        # Ancho de banda
        tk.Label(controls, text="Ancho de banda disponible (Mbps):",
                 bg=BG, fg=FG, font=("Segoe UI", 11)).grid(row=0, column=0, sticky="w")
        self.bw_value_label = tk.Label(controls, text="50", bg=BG, fg=ACCENT,
                                       font=("Segoe UI", 14, "bold"), width=6)
        self.bw_value_label.grid(row=0, column=2, padx=(10, 0))

        bw_scale = ttk.Scale(controls, from_=1, to=1000, orient="horizontal",
                             variable=self.bw_var, command=lambda _: self.refresh(),
                             length=600)
        bw_scale.grid(row=1, column=0, columnspan=3, sticky="we", pady=(5, 15))

        # Holgura
        tk.Label(controls, text="Holgura por jitter (%):",
                 bg=BG, fg=FG, font=("Segoe UI", 11)).grid(row=2, column=0, sticky="w")
        self.hr_value_label = tk.Label(controls, text="30", bg=BG, fg=ACCENT,
                                       font=("Segoe UI", 14, "bold"), width=6)
        self.hr_value_label.grid(row=2, column=2, padx=(10, 0))

        hr_scale = ttk.Scale(controls, from_=0, to=50, orient="horizontal",
                             variable=self.headroom_var,
                             command=lambda _: self.refresh(),
                             length=600)
        hr_scale.grid(row=3, column=0, columnspan=3, sticky="we", pady=(5, 0))

        controls.columnconfigure(0, weight=1)

    # ----------------------------------------------------------------- table
    def _build_table(self):
        frame = tk.Frame(self.root, bg=BG)
        frame.pack(fill="x", padx=20, pady=(15, 5))

        tk.Label(frame, text="Llamadas soportadas por códec",
                 bg=BG, fg=FG, font=("Segoe UI", 12, "bold")).pack(anchor="w", pady=(0, 5))

        columns = ("codec", "bitrate", "bw_call", "theoretical", "realistic", "notes")
        self.tree = ttk.Treeview(frame, columns=columns, show="headings", height=6)
        self.tree.heading("codec", text="Códec")
        self.tree.heading("bitrate", text="Bitrate")
        self.tree.heading("bw_call", text="BW por llamada")
        self.tree.heading("theoretical", text="Teóricas")
        self.tree.heading("realistic", text="Realistas")
        self.tree.heading("notes", text="Notas")
        self.tree.column("codec", width=120, anchor="w")
        self.tree.column("bitrate", width=90, anchor="center")
        self.tree.column("bw_call", width=130, anchor="center")
        self.tree.column("theoretical", width=90, anchor="center")
        self.tree.column("realistic", width=90, anchor="center")
        self.tree.column("notes", width=420, anchor="w")
        self.tree.pack(fill="x")

    # ----------------------------------------------------------------- chart
    def _build_chart(self):
        frame = tk.Frame(self.root, bg=BG)
        frame.pack(fill="both", expand=True, padx=20, pady=(10, 5))

        tk.Label(frame, text="Llamadas realistas por códec",
                 bg=BG, fg=FG, font=("Segoe UI", 12, "bold")).pack(anchor="w")

        self.figure = Figure(figsize=(9, 3.5), facecolor=BG)
        self.ax = self.figure.add_subplot(111)
        self.canvas = FigureCanvasTkAgg(self.figure, master=frame)
        self.canvas.get_tk_widget().pack(fill="both", expand=True)

    # -------------------------------------------------------- formula footer
    def _build_formula_footer(self):
        footer = tk.Frame(self.root, bg=BG)
        footer.pack(fill="x", padx=20, pady=(0, 15))

        text = (
            f"Fórmula: BW_llamada (kbps) = 2 × (payload_bytes + {RTP_UDP_IP_ETH_OVERHEAD_BYTES}"
            f" bytes overhead) × 8 × {PACKETS_PER_SECOND} pps / 1000"
            f"   |   Intervalo de paquete: {PACKET_INTERVAL_MS} ms"
            f"   |   Llamadas realistas = BW_total × (1 - holgura) / BW_llamada"
        )
        tk.Label(footer, text=text, bg=BG, fg="#bdc3c7",
                 font=("Consolas", 9), wraplength=1040, justify="left").pack(anchor="w")

    # ----------------------------------------------------------------- logic
    def refresh(self):
        bw = self.bw_var.get()
        headroom = self.headroom_var.get()
        self.bw_value_label.config(text=f"{bw}")
        self.hr_value_label.config(text=f"{headroom}")

        rows = calls_table(bw, headroom)

        # Reset tree
        for item in self.tree.get_children():
            self.tree.delete(item)
        for row in rows:
            self.tree.insert("", "end",
                             values=(row["label"],
                                     f"{row['bitrate_kbps']} kbps",
                                     f"{row['bw_per_call_kbps']} kbps",
                                     row["theoretical"],
                                     row["realistic"],
                                     CODECS[row["key"]]["notes"]))

        # Refresh chart
        self.ax.clear()
        labels = [row["label"] for row in rows]
        values = [row["realistic"] for row in rows]
        colors = [row["color"] for row in rows]

        bars = self.ax.bar(labels, values, color=colors, edgecolor=BG, linewidth=2)
        self.ax.set_facecolor(BG)
        self.ax.tick_params(colors=FG)
        for spine in self.ax.spines.values():
            spine.set_color("#34495e")
        self.ax.set_ylabel("Llamadas simultáneas", color=FG)
        self.ax.set_title(
            f"Capacidad con {bw} Mbps y {headroom}% de holgura",
            color=FG, fontsize=11
        )
        for bar, value in zip(bars, values):
            self.ax.text(bar.get_x() + bar.get_width() / 2,
                         value + max(values) * 0.01,
                         f"{value}",
                         ha="center", color=FG, fontsize=10, fontweight="bold")
        self.figure.tight_layout()
        self.canvas.draw_idle()


    # ---------------------------------------------------- bandwidth measure
    def measure_bandwidth(self):
        """Lanza la medición de BW en un thread aparte para no bloquear la UI."""
        self.measure_btn.config(state="disabled", text="Midiendo…")
        self.measure_status.config(text="Conectando con Speedtest…", fg=WARNING)
        thread = threading.Thread(target=self._do_measure, daemon=True)
        thread.start()

    def _do_measure(self):
        """Ejecuta speedtest. Corre en thread no-UI."""
        try:
            import speedtest  # local import: la dep solo se carga si se usa
        except ImportError:
            self.root.after(
                0,
                self._on_measure_error,
                "Falta la librería speedtest-cli.\nInstalalo con:\n  pip install speedtest-cli",
            )
            return

        try:
            self.root.after(
                0,
                lambda: self.measure_status.config(
                    text="Buscando mejor servidor…", fg=WARNING
                ),
            )
            st = speedtest.Speedtest()
            st.get_best_server()

            self.root.after(
                0,
                lambda: self.measure_status.config(
                    text="Midiendo descarga…", fg=WARNING
                ),
            )
            download_bps = st.download()
            download_mbps = max(1, int(download_bps / 1_000_000))
            self.root.after(0, self._on_measure_done, download_mbps)
        except Exception as exc:  # noqa: BLE001 — mostrar al usuario
            self.root.after(0, self._on_measure_error, str(exc))

    def _on_measure_done(self, mbps: int):
        capped = min(mbps, 1000)
        self.bw_var.set(capped)
        nota = f" (limitado al máximo del slider: 1000)" if mbps > 1000 else ""
        self.measure_status.config(
            text=f"BW de descarga: {mbps} Mbps{nota}", fg=SUCCESS
        )
        self.measure_btn.config(state="normal", text="📡  Medir BW de mi red")
        self.refresh()

    def _on_measure_error(self, message: str):
        self.measure_status.config(text="No se pudo medir", fg="#e74c3c")
        self.measure_btn.config(state="normal", text="📡  Medir BW de mi red")
        messagebox.showerror(
            "Error al medir BW",
            f"No se pudo conectar con Speedtest.net.\n\nDetalle:\n{message}\n\n"
            "Verifica conexión a internet. Mientras tanto, podés mover el slider "
            "manualmente con un valor estimado.",
        )


def main():
    root = tk.Tk()
    CalculatorApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
