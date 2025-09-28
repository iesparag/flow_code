import { Component, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AudiencesService } from '../../services/audiences.service';
import { Audience, Recipient } from '../../models/audience.model';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatMenuModule } from '@angular/material/menu';

@Component({
  selector: 'app-audiences-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatListModule, MatSnackBarModule, MatIconModule, MatDialogModule, MatTooltipModule, MatProgressBarModule, MatMenuModule],
  templateUrl: './audiences-page.component.html',
  styleUrls: ['./audiences-page.component.scss']
})
export class AudiencesPageComponent {
  items: Audience[] = [];
  name = '';
  recipientsJson = '';
  selectedId: string | null = null;
  loadingList = false;
  saving = false;
  deleting = false;
  showImportHelp = false;

  @ViewChild('deleteDialog') deleteDialogTpl!: TemplateRef<any>;

  constructor(private api: AudiencesService, private snack: MatSnackBar, private dialog: MatDialog) {
    this.load();
  }

  load() {
    this.loadingList = true;
    this.api.list().subscribe({
      next: (res) => this.items = res,
      error: (e) => { console.error(e); this.snack.open('Failed to load audiences', 'Dismiss', { duration: 2500 }); },
      complete: () => this.loadingList = false
    });
  }

  create() {
    let recipients: Recipient[] = [];
    try { recipients = JSON.parse(this.recipientsJson || '[]'); } catch { alert('Invalid JSON'); return; }
    const audience: Audience = { name: this.name || 'Untitled Audience', source: 'csv', recipients };
    this.saving = true;
    this.api.create(audience).subscribe({
      next: () => { this.snack.open('Audience created', 'OK', { duration: 1500 }); this.cancelEdit(); this.load(); },
      error: (e) => { console.error(e); this.snack.open('Create failed', 'Dismiss', { duration: 2000 }); },
      complete: () => this.saving = false
    });
  }

  select(a: Audience) {
    this.selectedId = (a as any)._id || null;
    this.name = a.name;
    this.recipientsJson = JSON.stringify(a.recipients || [], null, 2);
    this.snack.open('Editing audience', undefined, { duration: 800 });
  }

  cancelEdit() {
    this.selectedId = null;
    this.name = '';
    this.recipientsJson = '';
  }

  save() {
    if (!this.selectedId) return;
    let recipients: Recipient[] = [];
    try { recipients = JSON.parse(this.recipientsJson || ''); } catch { this.snack.open('Invalid JSON', 'Dismiss', { duration: 2000 }); return; }
    const patch: Partial<Audience> = { name: (this.name || '').trim(), recipients } as any;
    this.saving = true;
    this.api.update(this.selectedId, patch).subscribe({
      next: () => { this.snack.open('Audience updated', 'OK', { duration: 1500 }); this.cancelEdit(); this.load(); },
      error: () => this.snack.open('Update failed', 'Dismiss', { duration: 2000 }),
      complete: () => this.saving = false
    });
  }

  openDeleteDialog(a?: Audience) {
    const data = a || (this.items.find(x => (x as any)._id === this.selectedId));
    this.dialog.open(this.deleteDialogTpl, { data });
  }

  confirmDelete(id?: string) {
    const delId = id || this.selectedId || undefined;
    if (!delId) return;
    this.deleting = true;
    this.api.delete(delId).subscribe({
      next: () => { this.snack.open('Audience deleted', 'OK', { duration: 1500 }); this.cancelEdit(); this.load(); },
      error: () => this.snack.open('Delete failed', 'Dismiss', { duration: 2000 }),
      complete: () => { this.deleting = false; this.dialog.closeAll(); }
    });
  }

  onImportFile(evt: Event) {
    const input = evt.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const name = file.name.toLowerCase();
    const reader = new FileReader();

    if (name.endsWith('.json')) {
      reader.onload = () => {
        try {
          const text = String(reader.result || '');
          const arr = this.parseJson(text);
          this.recipientsJson = JSON.stringify(arr, null, 2);
          this.snack.open(`Imported ${arr.length} recipients from JSON`, 'OK', { duration: 1800 });
        } catch {
          this.snack.open('Invalid JSON file', 'Dismiss', { duration: 2000 });
        }
      };
      reader.readAsText(file);
    } else if (name.endsWith('.csv')) {
      reader.onload = () => {
        try {
          const text = String(reader.result || '');
          const arr = this.parseCsv(text);
          this.recipientsJson = JSON.stringify(arr, null, 2);
          this.snack.open(`Imported ${arr.length} recipients from CSV`, 'OK', { duration: 1800 });
        } catch {
          this.snack.open('Invalid CSV file', 'Dismiss', { duration: 2000 });
        }
      };
      reader.readAsText(file);
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      (async () => {
        try {
          const XLSX = await import('xlsx');
          reader.onload = () => {
            const data = new Uint8Array(reader.result as ArrayBuffer);
            const wb = XLSX.read(data, { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
            const arr = rows.map(r => ({ email: String((r.email || r.Email || r.EMAIL) ?? '').trim(), name: String((r.name || r.Name || r.NAME) ?? '').trim() || undefined }))
              .filter(r => !!r.email);
            this.recipientsJson = JSON.stringify(arr, null, 2);
            this.snack.open(`Imported ${arr.length} recipients from Excel`, 'OK', { duration: 2000 });
          };
          reader.readAsArrayBuffer(file);
        } catch (e) {
          console.error(e);
          this.snack.open('Excel parsing not available. Run: npm i xlsx', 'Dismiss', { duration: 3500 });
        }
      })();
    } else if (name.endsWith('.pdf')) {
      this.snack.open('PDF parsing needs pdfjs. For now, please use CSV/JSON/Excel.', 'OK', { duration: 3500 });
    } else {
      this.snack.open('Unsupported file type. Use JSON or CSV.', 'Dismiss', { duration: 2500 });
    }

    // allow re-selecting the same file
    input.value = '';
  }

  private parseJson(text: string) {
    const arr = JSON.parse(text);
    if (!Array.isArray(arr)) throw new Error('JSON must be an array');
    return arr
      .map((r: any) => ({ email: String(r.email || '').trim(), name: r.name ? String(r.name).trim() : undefined }))
      .filter((r: any) => !!r.email);
  }

  private parseCsv(text: string) {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (!lines.length) return [] as any[];
    const parseLine = (line: string) => {
      const out: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
          else { inQuotes = !inQuotes; }
        } else if (ch === ',' && !inQuotes) {
          out.push(cur); cur = '';
        } else {
          cur += ch;
        }
      }
      out.push(cur);
      return out.map(s => s.trim());
    };
    const header = parseLine(lines[0]).map(h => h.toLowerCase());
    const idxEmail = header.indexOf('email');
    const idxName = header.indexOf('name');
    if (idxEmail === -1) throw new Error('CSV must contain email column');
    const rows = lines.slice(1).map(parseLine);
    return rows.map(cols => ({
      email: (cols[idxEmail] || '').trim(),
      name: idxName !== -1 ? (cols[idxName] || '').trim() : undefined,
    })).filter(r => !!r.email);
  }
}
