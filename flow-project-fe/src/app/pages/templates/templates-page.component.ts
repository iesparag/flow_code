import { Component, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TemplatesService } from '../../services/templates.service';
import { EmailTemplate } from '../../models/template.model';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatMenuModule } from '@angular/material/menu';
import { QuillModule } from 'ngx-quill';

@Component({
  selector: 'app-templates-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatListModule, MatSnackBarModule, MatIconModule, MatDialogModule, MatTooltipModule, MatProgressBarModule, MatMenuModule, QuillModule],
  templateUrl: './templates-page.component.html',
  styleUrls: ['./templates-page.component.scss']
})
export class TemplatesPageComponent {
  items: EmailTemplate[] = [];
  name = '';
  subject = '';
  body = '';
  selectedId: string | null = null;
  loadingList = false;
  saving = false;
  deleting = false;
  attachments: { name: string; url?: string; contentBase64?: string }[] = [];
  newUrlName = '';
  newUrl = '';

  @ViewChild('deleteDialog') deleteDialogTpl!: TemplateRef<any>;

  constructor(private api: TemplatesService, private snack: MatSnackBar, private dialog: MatDialog) {
    this.load();
  }

  load() {
    this.loadingList = true;
    this.api.list().subscribe({
      next: (res) => this.items = res,
      error: (e) => { console.error(e); this.snack.open('Failed to load templates', 'Dismiss', { duration: 2500 }); },
      complete: () => this.loadingList = false
    });
  }

  create() {
    if (!this.name || !this.subject || !this.body) { this.snack.open('Please fill all fields', 'OK', { duration: 2000 }); return; }
    const payload: EmailTemplate = { name: this.name.trim(), subject: this.subject.trim(), body: this.body, attachments: this.attachments } as any;
    this.saving = true;
    this.api.create(payload).subscribe({
      next: () => { this.snack.open('Template created', 'OK', { duration: 1500 }); this.cancelEdit(); this.load(); },
      error: (e) => { console.error(e); this.snack.open('Failed to create template', 'Dismiss', { duration: 2500 }); },
      complete: () => this.saving = false
    });
  }

  useSample() {
    this.body = `<p>Hi {{name}},</p>\n<p>Quick hello — I’d love to share a small idea that could improve workflows at {{company}}.</p>\n<p>If you have 10–12 minutes, can we schedule a quick call?</p>\n<p>Thanks,<br/>Parag</p>`;
  }

  select(t: EmailTemplate) {
    this.selectedId = (t as any)._id || null;
    this.name = t.name;
    this.subject = t.subject;
    this.body = t.body as any;
    this.attachments = (t.attachments ? JSON.parse(JSON.stringify(t.attachments)) : []);
    this.snack.open('Editing template', undefined, { duration: 800 });
  }

  cancelEdit() {
    this.selectedId = null;
    this.name = '';
    this.subject = '';
    this.body = '';
    this.attachments = [];
    this.newUrlName = '';
    this.newUrl = '';
  }

  save() {
    if (!this.selectedId) return;
    const patch: Partial<EmailTemplate> = { name: this.name.trim(), subject: this.subject.trim(), body: this.body, attachments: this.attachments } as any;
    this.saving = true;
    this.api.update(this.selectedId, patch).subscribe({
      next: () => { this.snack.open('Template updated', 'OK', { duration: 1500 }); this.cancelEdit(); this.load(); },
      error: (e) => { console.error(e); this.snack.open('Update failed', 'Dismiss', { duration: 2000 }); },
      complete: () => this.saving = false
    });
  }

  openDeleteDialog(t?: EmailTemplate) {
    const data = t || (this.items.find(x => (x as any)._id === this.selectedId) as EmailTemplate | undefined);
    this.dialog.open(this.deleteDialogTpl, { data });
  }

  confirmDelete(id?: string) {
    const delId = id || this.selectedId || undefined;
    if (!delId) return;
    this.deleting = true;
    this.api.delete(delId).subscribe({
      next: () => { this.snack.open('Template deleted', 'OK', { duration: 1500 }); this.cancelEdit(); this.load(); },
      error: (e) => { console.error(e); this.snack.open('Delete failed', 'Dismiss', { duration: 2000 }); },
      complete: () => { this.deleting = false; this.dialog.closeAll(); }
    });
  }

  trackById(_index: number, item: any) { return item?._id || item?.id || _index; }

  async onFilesSelected(evt: Event) {
    const input = evt.target as HTMLInputElement;
    const files = input.files;
    if (!files || !files.length) return;
    const maxBytes = 5 * 1024 * 1024; // 5MB
    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'image/png', 'image/jpeg'];
    for (const f of Array.from(files)) {
      if (f.size > maxBytes) { this.snack.open(`Skipped ${f.name} (over 5MB)`, 'Dismiss', { duration: 2500 }); continue; }
      if (allowed.indexOf(f.type) === -1) { this.snack.open(`Skipped ${f.name} (type not allowed)`, 'Dismiss', { duration: 2500 }); continue; }
      const base64 = await this.fileToBase64(f);
      this.attachments.push({ name: f.name, contentBase64: base64 });
    }
    // reset input so selecting the same file again triggers change
    input.value = '';
  }

  fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const res = (reader.result as string) || '';
        const base64 = res.split(',')[1] || res; // strip data URL prefix if present
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  addUrlAttachment() {
    if (!this.newUrlName || !this.newUrl) { this.snack.open('Add name and URL', 'OK', { duration: 1500 }); return; }
    this.attachments.push({ name: this.newUrlName.trim(), url: this.newUrl.trim() });
    this.newUrlName = '';
    this.newUrl = '';
  }

  removeAttachment(i: number) { this.attachments.splice(i, 1); }
}
