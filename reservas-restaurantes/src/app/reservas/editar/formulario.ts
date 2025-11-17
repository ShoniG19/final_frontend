import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { ReservaService } from '../../services/reserva.service';
import { RestauranteService } from '../../services/restaurante.service';
import { ZonaService } from '../../services/zona.service';
import { MesaService } from '../../services/mesa.service';
import { DisponibilidadService } from '../../services/disponibilidad.service';


@Component({
  selector: 'app-reserva-editar-formulario',
  imports: [CommonModule, FormsModule],
  standalone: true,
  templateUrl: './formulario.html',
  styleUrls: ['./formulario.css']
})
export class FormularioComponent {

  private normalizeDate(d: string): string {
    if (!d) return '';
    const parts = d.split('-');
    if (parts.length === 3) return `${parts[0]}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}`;
    const dateObj = new Date(d);
    if (isNaN(dateObj.getTime())) return d;
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth()+1).padStart(2,'0');
    const dd = String(dateObj.getDate()).padStart(2,'0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private normalizeTime(t: string): string {
    if (!t) return '';
    const parts = t.split(':').map(p => p.trim());
    if (parts.length === 1) return parts[0].padStart(2,'0') + ':00';
    const hh = parts[0].padStart(2,'0');
    const mm = (parts[1] || '00').padStart(2,'0');
    return `${hh}:${mm}`;
  }

  id: string | null = null;

  errorMessage: string = '';

  restaurantes: any[] = [];
  zonas: any[] = [];
  mesas: any[] = [];

  restauranteId: string = '';
  zonaId: string = '';
  mesaId: string = '';

  fecha: string = '';
  hora: string = '';
  cantidadPersonas: number = 1;
  horariosDisponibles: string[] = [];
  capacidadSuficiente: boolean = true;

  nombreCliente: string = '';
  apellidoCliente: string = '';
  telefono: string = '';


  submitted: boolean = false;
  touchedNombre: boolean = false;
  touchedRestaurante: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private reservaService: ReservaService,
    private restauranteService: RestauranteService,
    private zonaService: ZonaService,
    private mesaService: MesaService,
    private disponibilidadService: DisponibilidadService
  ) {
    this.id = this.route.snapshot.paramMap.get('id');
    this.restaurantes = this.restauranteService.getAll();

    if (this.id) {
      const r = this.reservaService.getById(this.id);
      if (r) {
        this.restauranteId = r.restauranteId;
        this.zonaId = r.zonaId;
        this.mesaId = r.mesaId || '';
        this.fecha = r.fecha;
        this.hora = r.hora;
        this.cantidadPersonas = r.cantidadPersonas || 1;
        this.nombreCliente = r.nombreCliente || '';
        this.apellidoCliente = r.apellidoCliente || '';
        this.telefono = r.telefono || '';
      }
    }

    if (this.restauranteId) {
      this.cargarZonas();
    }
    if (this.zonaId) {
      this.cargarMesas();
    }
    if (this.fecha) {
      this.cargarHorarios(this.id || undefined);
    }
  }

  cargarZonas() {
    if (!this.restauranteId) {
      this.zonas = [];
      return;
    }
    this.zonas = this.zonaService.getByRestaurante(this.restauranteId);
  }

  cargarMesas() {
    if (!this.zonaId) {
      this.mesas = [];
      return;
    }

    const mesasRaw = this.mesaService.getByZona(this.zonaId) || [];

    const reservas = this.reservaService.getAll().filter(r => {
      if (this.id && r.id === this.id) return false; 
      const sameZona = r.zonaId === this.zonaId;
      const sameFecha = this.fecha ? (this.normalizeDate(r.fecha) === this.normalizeDate(this.fecha)) : false;
      const sameHora = this.hora ? (this.normalizeTime(r.hora) === this.normalizeTime(this.hora)) : false;
      return sameZona && sameFecha && sameHora;
    });

    const ocupadas = new Set(reservas.map(r => r.mesaId).filter(Boolean));

    this.mesas = mesasRaw.map(m => {
      const disabled = ocupadas.has(m.id);
      const label = disabled ? `${m.numero} (ocupada)` : `${m.numero} — ${m.capacidad} pers`;
      return { ...m, disabled, label };
    });

    if (this.mesaId) {
      const sel = this.mesas.find(x => x.id === this.mesaId);
      if (sel && sel.disabled) {
       
        const reservaPropia = this.reservaService.getById(this.id || '');
        if (!reservaPropia || reservaPropia.mesaId !== this.mesaId) {
          this.mesaId = '';
          this.errorMessage = 'La mesa seleccionada ya está ocupada en esa fecha/hora. Seleccione otra o deje "Ninguna" para reasignamiento automático.';
        }
      }
    }
  }

    cargarHorarios(excludeReservaId?: string) {
    this.horariosDisponibles = [];
    if (!this.zonaId || !this.fecha) return;
    const zona = this.zonaService.getById(this.zonaId);
    if (!zona || !Array.isArray(zona.horarios)) return;

    const todasHorarios = zona.horarios.map(h => this.normalizeTime(h));
    const mesas = this.mesaService.getAll();
    let reservas = this.reservaService.getAll();
    if (excludeReservaId) reservas = reservas.filter(r => r.id !== excludeReservaId);

    const disponibles: string[] = [];
    for (const horario of todasHorarios) {
      const mesa = this.disponibilidadService.asignarMesa(mesas, reservas, this.zonaId, this.fecha, horario, this.cantidadPersonas);
      if (mesa) disponibles.push(horario);
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


  onFechaChange() {
    this.fecha = this.normalizeDate(this.fecha);
    this.cargarHorarios(this.id || undefined);
    this.hora = '';
    this.verificarCapacidad?.();
    this.cargarMesas();
  }

  onHoraSelect() {
    this.hora = this.normalizeTime(this.hora);
    this.verificarCapacidad?.();
    this.cargarMesas();
}

  guardar() {
    this.submitted = true;

    if (!this.restauranteId || !this.zonaId || !this.fecha || !this.hora ||
        !this.nombreCliente || !this.apellidoCliente) {
      return;
    }

    const reservas = this.reservaService.getAll().filter(r => r.id !== this.id);
    const mesasZona = this.mesaService.getByZona(this.zonaId);
    const fechaNorm = this.normalizeDate(this.fecha);
    const horaNorm = this.normalizeTime(this.hora);

    let mesaAsignada = this.mesaId || '';

    if (!mesaAsignada) {
      const disponibles = mesasZona.filter(m => {
        if (m.capacidad < this.cantidadPersonas) return false;

        const ocupada = reservas.some(r =>
          r.mesaId === m.id &&
          this.normalizeDate(r.fecha) === fechaNorm &&
          this.normalizeTime(r.hora) === horaNorm
        );

        return !ocupada;
      });

      if (disponibles.length === 0) {
        alert("No hay mesas disponibles para ese horario.");
        return;
      }

      mesaAsignada = disponibles[0].id;
    }

    const payload = {
      fecha: fechaNorm,
      hora: horaNorm,
      cantidadPersonas: this.cantidadPersonas,
      restauranteId: this.restauranteId,
      zonaId: this.zonaId,
      mesaId: mesaAsignada,
      nombreCliente: this.nombreCliente,
      apellidoCliente: this.apellidoCliente,
      telefono: this.telefono
    };

    if (this.id) {
      this.reservaService.update(this.id, payload);
    } else {
      this.reservaService.create(payload);
    }

    this.router.navigate(['/reservas']);
  }


  cancelar() {
    this.router.navigate(['/reservas']);
  }

  atras() {
    this.router.navigate(['/reservas']);
  }
}
