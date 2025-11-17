import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { RestauranteService } from '../../services/restaurante.service';
import { ZonaService } from '../../services/zona.service';
import { MesaService } from '../../services/mesa.service';
import { ReservaService } from '../../services/reserva.service';
import { DisponibilidadService } from '../../services/disponibilidad.service';

import { Restaurante } from '../../models/restaurante';
import { Zona } from '../../models/zona';
import { Mesa } from '../../models/mesa';

@Component({
  selector: 'app-reserva-formulario',
  imports: [CommonModule, FormsModule],
  standalone: true,
  templateUrl: './formulario.html',
  styleUrls: ['./formulario.css']
})
export class FormularioComponent {
  pasoActual: number = 1;
  totalPasos: number = 5;

  restauranteId: string = '';
  zonaId: string = '';
  fecha: string = '';
  hora: string = '';
  cantidadPersonas: number = 1;
  nombreCliente: string = '';
  apellidoCliente: string = '';
  telefono: string = '';

  restaurantes: Restaurante[] = [];
  zonas: Zona[] = [];
  horariosDisponibles: string[] = [];

  fechaSeleccionada: Date = new Date();
  diasCalendario: any[] = [];
  mesActual: string = '';
  anioActual: string = '';
  diaSeleccionado: number = 0;
  mesIndex: number = 0;
  anio: number = 0;

  capacidadSuficiente: boolean = true;

  constructor(
    private restauranteService: RestauranteService,
    private zonaService: ZonaService,
    private mesaService: MesaService,
    private reservaService: ReservaService,
    private disponibilidadService: DisponibilidadService,
    private router: Router
  ) {
    this.restaurantes = this.restauranteService.getAll();
    const hoy = new Date();
    this.mesIndex = hoy.getMonth();
    this.anio = hoy.getFullYear();
    this.generarCalendario(this.mesIndex, this.anio);
  }

  siguientePaso() {
    if (this.pasoActual < this.totalPasos && this.validarPasoActual()) {
      this.pasoActual++;
      
      if (this.pasoActual === 2) {
        this.cargarZonas();
      } else if (this.pasoActual === 3) {
        this.cargarHorarios();
      }
    }
  }

  anteriorPaso() {
    if (this.pasoActual > 1) {
      this.pasoActual--;
    }
  }

  irAPaso(paso: number) {
    if (paso >= 1 && paso <= this.totalPasos) {
      this.pasoActual = paso;
    }
    if (paso === 4) {
      this.verificarCapacidad();
    }
  }

  validarPasoActual(): boolean {
    switch (this.pasoActual) {
      case 1:
        return !!this.restauranteId;
      case 2:
        return !!this.zonaId;
      case 3:
        return !!this.fecha && !!this.hora;
      case 4:
        return this.cantidadPersonas > 0;
      case 5:
        return !!this.nombreCliente && !!this.apellidoCliente && !!this.telefono;
      default:
        return false;
    }
  }

  cargarZonas() {
    if (this.restauranteId) {
      this.zonas = this.zonaService.getByRestaurante(this.restauranteId);
    }
  }

  cargarHorarios() {
    this.horariosDisponibles = [];

    if (!this.zonaId || !this.fecha) {
      return;
    }

    const zona = this.zonaService.getById(this.zonaId);
    if (!zona || !Array.isArray(zona.horarios)) return;

    const todasHorarios = zona.horarios.map(h => this.normalizeTime(h));
    const mesas = this.mesaService.getAll();
    let reservas = this.reservaService.getAll();


    const disponibles: string[] = [];

    for (const horarioRaw of todasHorarios) {
      const horario = this.normalizeTime(horarioRaw);

      const mesa = this.disponibilidadService.asignarMesa(
        mesas,
        reservas,
        this.zonaId,
        this.fecha,
        horario,
        this.cantidadPersonas
      );

      if (mesa) {
        disponibles.push(horario);
      }
    }

    this.horariosDisponibles = Array.from(new Set(disponibles)).sort((a,b) => a.localeCompare(b));
  }

  verificarCapacidad() {
    if (!this.zonaId || !this.fecha || !this.hora) {
      this.capacidadSuficiente = false;
      return;
    }

    const mesas = this.mesaService.getAll().filter(m => m.zonaId === this.zonaId);

    const existeMesa = mesas.some(m => (m.capacidad || 0) >= this.cantidadPersonas);

    this.capacidadSuficiente = existeMesa;
  }

  generarCalendario(month?: number, year?: number) {
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    const m = (typeof month === 'number') ? month : this.mesIndex;
    const y = (typeof year === 'number') ? year : this.anio;

    this.mesIndex = m;
    this.anio = y;
    this.mesActual = meses[m];
    this.anioActual = y.toString();

    const primerDia = new Date(y, m, 1);
    const ultimoDia = new Date(y, m + 1, 0);

    const offset = primerDia.getDay();

    const today = new Date();
    today.setHours(0,0,0,0);

    const cells: Array<{ num: number | null; inactive?: boolean; past?: boolean }> = [];
    for (let i = 0; i < offset; i++) {
      cells.push({ num: null, inactive: true });
    }

    for (let d = 1; d <= ultimoDia.getDate(); d++) {
      const dateObj = new Date(y, m, d);
      dateObj.setHours(0,0,0,0);
      const pasado = dateObj < today;

      if (pasado) {
        cells.push({ num: d, inactive: true, past: true });
      } else {
        cells.push({ num: d, inactive: false });
      }
    }

    while (cells.length % 7 !== 0) {
      cells.push({ num: null, inactive: true });
    }

    this.diasCalendario = cells;
  }

  cambiarMes(delta: number) {
    let nuevoMes = this.mesIndex + delta;
    let nuevoAnio = this.anio;
    while (nuevoMes < 0) {
      nuevoMes += 12;
      nuevoAnio -= 1;
    }
    while (nuevoMes > 11) {
      nuevoMes -= 12;
      nuevoAnio += 1;
    }
    this.generarCalendario(nuevoMes, nuevoAnio);
  }

  seleccionarFecha(dia: number) {
    if (!dia) return;

    const fechaLocal = new Date(this.anio, this.mesIndex, dia);
    fechaLocal.setHours(0,0,0,0);
    const today = new Date();
    today.setHours(0,0,0,0);
    if (fechaLocal < today) return; // safety: ignore past dates

    const yyyy = fechaLocal.getFullYear();
    const mm = String(fechaLocal.getMonth() + 1).padStart(2, '0');
    const dd = String(fechaLocal.getDate()).padStart(2, '0');

    this.fecha = `${yyyy}-${mm}-${dd}`;
    this.diaSeleccionado = dia;
    this.cargarHorarios();
  }

  estaDiaSeleccionado(dia: number): boolean {
    return this.diaSeleccionado === dia;
  }

  disminuirCantidad() {
    this.cantidadPersonas = Math.max(1, this.cantidadPersonas - 1);
    this.verificarCapacidad();
  }

  aumentarCantidad() {
    this.cantidadPersonas++;
    this.verificarCapacidad();
  }

  seleccionarCantidadRapida(cantidad: number) {
    this.cantidadPersonas = cantidad;
    this.verificarCapacidad();  
  }

  confirmarReserva() {
    if (!this.validarPasoActual()) {
      return;
    }

    const mesas = this.mesaService.getAll();
    const reservas = this.reservaService.getAll();

    const mesa = this.disponibilidadService.asignarMesa(
      mesas, reservas, this.zonaId, this.fecha, this.hora, this.cantidadPersonas
    );

    if (!mesa) {
      alert('No hay mesas disponibles para ese horario.');
      return;
    }

    this.reservaService.create({
      fecha: this.fecha,
      hora: this.hora,
      cantidadPersonas: this.cantidadPersonas,
      nombreCliente: this.nombreCliente,
      apellidoCliente: this.apellidoCliente,
      telefono: this.telefono,
      mesaId: mesa.id,
      zonaId: this.zonaId,
      restauranteId: this.restauranteId
    });

    this.router.navigate(['/reservas']);
  }

  getNombreRestaurante(): string {
    const restaurante = this.restaurantes.find(r => r.id === this.restauranteId);
    return restaurante ? restaurante.nombre : '';
  }

  getNombreZona(): string {
    const zona = this.zonas.find(z => z.id === this.zonaId);
    return zona ? zona.nombre : '';
  }

  getFechaFormateada(): string {
    if (!this.fecha) return '';
    const [y, m, d] = this.fecha.split('-').map(s => parseInt(s, 10));
    return `${d}/${m}/${y}`;
  }

  normalizeTime(t: string): string {
    if (!t) return '';
    const parts = t.split(':').map(p => p.trim());
    if (parts.length === 1) return parts[0].padStart(2, '0') + ':00';
    const hh = parts[0].padStart(2, '0');
    const mm = (parts[1] || '00').padStart(2, '0');
    return `${hh}:${mm}`;
  }

  normalizeDate(d: string): string {
    if (!d) return '';
    const parts = d.split('-');
    if (parts.length === 3) {
      const yyyy = parts[0];
      const mm = parts[1].padStart(2, '0');
      const dd = parts[2].padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }

    const dateObj = new Date(d);
    if (isNaN(dateObj.getTime())) return d;
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  atras(){
    this.router.navigate(['reservas']);
  }
}