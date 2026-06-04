import { Component, inject } from '@angular/core';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { HlmMenubarImports } from '@spartan-ng/helm/menubar';
import { PriorityListMenuService } from '../../services/priority-list-menu.service';
import type { ColumnDef } from '../../types/column-def';

@Component({
  selector: 'app-priority-list-menu',
  imports: [HlmMenubarImports, HlmDropdownMenuImports],
  templateUrl: './priority-list-menu.html',
})
export class PriorityListMenu {
  private readonly menuService = inject(PriorityListMenuService);

  protected readonly columns = this.menuService.columns;

  protected isColumnVisible(key: string): boolean {
    return this.menuService.isColumnVisible(key);
  }

  protected toggleColumn(column: ColumnDef): void {
    this.menuService.toggleColumn(column.key);
  }
}
