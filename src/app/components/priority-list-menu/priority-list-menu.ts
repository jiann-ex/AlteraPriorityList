import { Component, inject, signal } from '@angular/core';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { HlmMenubarImports } from '@spartan-ng/helm/menubar';
import { PriorityListMenuService } from '../../services/priority-list-menu.service';
import type { ColumnDef } from '../../types/column-def';
import { PriorityListService } from '../../services/priority-list.service';
import { HlmAlertDialogImports } from '@spartan-ng/helm/alert-dialog';
import { finalize } from 'rxjs';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';

@Component({
  selector: 'app-priority-list-menu',
  imports: [
    HlmMenubarImports,
    HlmDropdownMenuImports,
    HlmAlertDialogImports,
    HlmButtonImports,
    HlmSpinnerImports,
  ],
  templateUrl: './priority-list-menu.html',
})
export class PriorityListMenu {
  private readonly service = inject(PriorityListService);
  private readonly menuService = inject(PriorityListMenuService);

  protected readonly columns = this.menuService.columns;
  exporting = signal(false);

  protected isColumnVisible(key: string): boolean {
    return this.menuService.isColumnVisible(key);
  }

  protected toggleColumn(column: ColumnDef): void {
    this.menuService.toggleColumn(column.key);
  }

  protected expandAll() {
    this.menuService.expandAll();
  }

  protected collapseAll() {
    this.menuService.collapseAll();
  }
  protected reload() {
    this.menuService.reload();
  }

  protected exportExcel(ctx: any) {
    this.exporting.set(true);
    this.service
      .exportExcel()
      .pipe(
        finalize(() => {
          this.exporting.set(false);
        }),
      )
      .subscribe((res) => {
        const blob = res.body;
        if (!blob) return;

        const filename = this.parseFilename(res.headers.get('Content-Disposition'));

        const url = window.URL.createObjectURL(blob);
        const linkElement = document.createElement('a');
        linkElement.href = url;
        linkElement.download = filename;
        linkElement.click();
        linkElement.remove();
        // Release the object URL once the download has been triggered
        window.URL.revokeObjectURL(url);
        ctx.close();
      });
  }

  /**
   * Extract the filename from a Content-Disposition header, supporting both the
   * RFC 5987 `filename*=UTF-8''...` form and the plain `filename="..."` form.
   * Falls back to a timestamped default when the header is missing.
   */
  private parseFilename(disposition: string | null): string {
    const fallback = `priority-list-${new Date().toISOString().slice(0, 10)}.xlsx`;
    if (!disposition) return fallback;

    // Prefer the RFC 5987 encoded form when present (e.g. filename*=UTF-8''report.xlsx)
    const encodedMatch = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(disposition);
    if (encodedMatch?.[1]) {
      try {
        return decodeURIComponent(encodedMatch[1].trim().replace(/^"|"$/g, ''));
      } catch {
        // fall through to the plain form / fallback
      }
    }

    const plainMatch = /filename=([^;]+)/i.exec(disposition);
    if (plainMatch?.[1]) {
      return plainMatch[1].trim().replace(/^"|"$/g, '');
    }

    return fallback;
  }
}
